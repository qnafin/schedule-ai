import type OpenAI from 'openai';
import { renderContextLine, type SenderContext } from '../shared/context';
import { extractText, logMcpCalls } from '../shared/responses';
import { buildRagContext } from '../../features/knowledge';
import {buildModelUri} from '../shared'
import { AGENTS, type AgentRole } from './config';
import { AgentState } from './state';
import { classify, type ClassifyResult } from './router';
import { detectHandoff } from './handoff';
import { smallTalk } from './smalltalk';

export type { SenderContext };

export interface EscalationContext {
  userInput: string;
  botResponse: string;
  sessionId: string;
  sender?: SenderContext;
}

export interface MultiAgentOptions {
  client: OpenAI;
  folderId: string;
  model: string;
  routerModel?: string;
  mcpTools: any[];
  onEscalate?: (ctx: EscalationContext) => Promise<void>;
  onRoute?: (role: ClassifyResult, input: string) => void;
}

const MAX_HANDOFF_DEPTH = 2;

export class MultiAgentAssistant {
  private readonly state = new AgentState();

  constructor(private readonly opts: MultiAgentOptions) {}

  // ============================================================
  // Публичное API
  // ============================================================

  async ask(
    userInput: string,
    sessionId = 'default',
    context?: SenderContext,
    depth = 0,
  ): Promise<string> {
    if (depth > MAX_HANDOFF_DEPTH) {
      console.log('[handoff] depth exceeded, fallback to SUPPORT');
      return this.fallbackToSupport(userInput, sessionId, context);
    }

    // Активный агент или классификация
    const role = await this.resolveRole(sessionId, userInput);
    if (role === 'SMALLTALK') return smallTalk(userInput);

    const isActive = this.state.getActive(sessionId) === role;
    this.opts.onRoute?.(role, userInput);
    console.log(`[router] → ${role}${isActive ? ' (active)' : ''}`);

    return this.runAgent(role, userInput, sessionId, context, depth);
  }

  resetSession(sessionId: string): void {
    this.state.reset(sessionId);
  }

  // ============================================================
  // Оркестрация
  // ============================================================

  private async resolveRole(
    sessionId: string,
    input: string,
  ): Promise<ClassifyResult> {
    const active = this.state.getActive(sessionId);
    if (active) return active;
    return classify(
      {
        client: this.opts.client,
        folderId: this.opts.folderId,
        model: this.opts.routerModel ?? this.opts.model,
      },
      input,
    );
  }

  private async runAgent(
    role: AgentRole,
    userInput: string,
    sessionId: string,
    context: SenderContext | undefined,
    depth: number,
  ): Promise<string> {
    const agent = AGENTS[role];
    const model = agent.model ?? this.opts.model

    const ragBlock = agent.useRag ? await this.loadRag(userInput) : '';
    const contextLine = renderContextLine(context);
    const input = [contextLine, ragBlock, userInput].filter(Boolean).join('\n');

    const tools = this.filterTools(agent.allowedTools);

    const response = await this.opts.client.responses.create({
      model: buildModelUri(this.opts.folderId, model),
      store: true,
      reasoning: { effort: 'low' },
      previous_response_id: this.state.getSession(sessionId, model),
      instructions: agent.instructions,
      input,
      ...(tools.length > 0 && { tools, tool_choice: 'auto' }),
    });

    logMcpCalls(response);

    // Handoff — агент сам вернул управление
    const handoff = detectHandoff(response);
    if (handoff) {
      console.log(`[handoff] ${role} → router (${handoff.reason ?? 'no reason'})`);
      this.state.clearActive(sessionId);
      this.state.clearSession(sessionId, model);
      return this.ask(userInput, sessionId, context, depth + 1);
    }

    // Агент справился
    this.state.setSession(sessionId, model, response.id);
    if (role !== 'SUPPORT') {
      this.state.setActive(sessionId, role);
    }

    const answer = extractText(response);

    if (agent.escalate) {
      await this.escalate(userInput, answer, sessionId, context);
    }

    return answer;
  }

  // ============================================================
  // Хелперы
  // ============================================================

  private async loadRag(query: string): Promise<string> {
    try {
      const ragContext = await buildRagContext(query);
      if (!ragContext) return '';
      console.log('[rag] контекст подмешан');
      return `[Контекст из базы знаний]\n${ragContext}\n\n`;
    } catch (err) {
      console.warn('[rag] failed:', (err as Error).message);
      return '';
    }
  }

  private async fallbackToSupport(
    userInput: string,
    sessionId: string,
    context?: SenderContext,
  ): Promise<string> {
    this.state.clearActive(sessionId);

    const agent = AGENTS.SUPPORT;
    const model = buildModelUri(
      this.opts.folderId,
      agent.model ?? this.opts.model,
    );

    const contextLine = renderContextLine(context);
    const input = [contextLine, userInput].filter(Boolean).join('\n');

    const response = await this.opts.client.responses.create({
      model,
      store: true,
      reasoning: { effort: 'low' },
      previous_response_id: this.state.getSession(sessionId, model),
      instructions: agent.instructions,
      input,
    });

    this.state.setSession(sessionId, model, response.id);
    const answer = extractText(response);

    await this.escalate(userInput, answer, sessionId, context);
    return answer;
  }

  private async escalate(
    userInput: string,
    answer: string,
    sessionId: string,
    context?: SenderContext,
  ): Promise<void> {
    if (!this.opts.onEscalate) return;
    try {
      await this.opts.onEscalate({
        userInput,
        botResponse: answer,
        sessionId,
        sender: context,
      });
      console.log('[support] эскалация админу');
    } catch (err) {
      console.warn('[support] escalation failed:', (err as Error).message);
    }
  }

  private filterTools(allowed: string[] | null): any[] {
    if (allowed === null) return [];
    return this.opts.mcpTools.map((tool) => ({
      ...tool,
      allowed_tools: allowed,
    }));
  }
}