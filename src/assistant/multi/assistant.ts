import type OpenAI from 'openai';
import { renderContextLine, type SenderContext } from '../shared/context';
import { buildModelUri } from '../shared/model';
import { buildRagContext } from '../../features/knowledge';
import { AGENTS, ROUTER_PROMPT, type AgentRole } from './config';

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
  onRoute?: (role: AgentRole | 'SMALLTALK', input: string) => void;
}

const MAX_HANDOFF_DEPTH = 2;

export class MultiAgentAssistant {
  /** Сессии per-model для previous_response_id. */
  private readonly sessions = new Map<string, string>();

  /** Активный агент на пользователя. */
  private readonly activeAgent = new Map<string, AgentRole>();

  constructor(private readonly opts: MultiAgentOptions) {}

  async ask(
    userInput: string,
    sessionId = 'default',
    context?: SenderContext,
    depth = 0,
  ): Promise<string> {
    // Защита от бесконечного handoff A → B → A → B
    if (depth > MAX_HANDOFF_DEPTH) {
      console.log(`[handoff] depth exceeded, fallback to SUPPORT`);
      return this.fallbackToSupport(userInput, sessionId, context);
    }

    // 1. Активный агент? Идём к нему без router
    let role = this.activeAgent.get(sessionId);
    const isActive = role !== undefined;

    if (!role) {
      role = await this.classify(userInput);
      if (role === 'SMALLTALK') {
        return this.smallTalk(userInput);
      }
    }

    this.opts.onRoute?.(role, userInput);
    console.log(`[router] → ${role}${isActive ? ' (active)' : ''}`);

    const agent = AGENTS[role];
    const agentModel = this.resolveModel(agent.model ?? this.opts.model);

    // 2. RAG если нужно
    let ragBlock = '';
    if (agent.useRag) {
      try {
        const ragContext = await buildRagContext(userInput);
        if (ragContext) {
          ragBlock = `[Контекст из базы знаний]\n${ragContext}\n\n`;
          console.log('[rag] контекст подмешан');
        }
      } catch (err) {
        console.warn('[rag] failed:', (err as Error).message);
      }
    }

    const contextLine = renderContextLine(context);
    const input = [contextLine, ragBlock.trim(), userInput]
      .filter(Boolean)
      .join('\n');

    const tools = this.filterTools(agent.allowedTools);
    const key = `${sessionId}:${agentModel}`;

    // 3. Вызов агента
    const response = await this.opts.client.responses.create({
      model: agentModel,
      store: true,
      reasoning: { effort: 'low' },
      previous_response_id: this.sessions.get(key),
      instructions: agent.instructions,
      input,
      ...(tools.length > 0 && { tools, tool_choice: 'auto' }),
    });

    this.logMcpCalls(response);

    // 4. Проверяем handoff
    const handoff = this.detectHandoff(response);
    if (handoff) {
      console.log(`[handoff] ${role} → router (${handoff.reason ?? 'no reason'})`);

      // Снимаем активного и сбрасываем сессию этого агента
      // (response содержит tool call — тащить его в следующий раз не надо)
      this.activeAgent.delete(sessionId);
      this.sessions.delete(key);

      // Перероутинг — рекурсивный вызов с depth + 1
      return this.ask(userInput, sessionId, context, depth + 1);
    }

    // 5. Агент справился — фиксируем
    this.sessions.set(key, response.id);

    // SUPPORT — финальный, не становится активным
    if (role !== 'SUPPORT') {
      this.activeAgent.set(sessionId, role);
    }

    const answer = this.extractText(response);

    // 6. Эскалация только для SUPPORT
    if (agent.escalate && this.opts.onEscalate) {
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

    return answer;
  }

  resetSession(sessionId: string): void {
    const prefix = `${sessionId}:`;
    for (const key of this.sessions.keys()) {
      if (key.startsWith(prefix)) {
        this.sessions.delete(key);
      }
    }
    this.activeAgent.delete(sessionId);
  }

  // ============================================================
  // Внутренние методы
  // ============================================================

  private resolveModel(shortOrUri: string): string {
    if (shortOrUri.startsWith('gpt://')) return shortOrUri;
    return buildModelUri(this.opts.folderId, shortOrUri);
  }

  private async classify(input: string): Promise<AgentRole | 'SMALLTALK'> {
    const routerModel = this.resolveModel(
      this.opts.routerModel ?? this.opts.model,
    );

    const response = await this.opts.client.responses.create({
      model: routerModel,
      store: false,
      reasoning: { effort: 'low' },
      instructions: ROUTER_PROMPT,
      input,
    });

    const text = this.extractText(response).toUpperCase();
    if (text.includes('SMALLTALK')) return 'SMALLTALK';
    if (text.includes('SCHEDULE')) return 'SCHEDULE';
    if (text.includes('KNOWLEDGE')) return 'KNOWLEDGE';
    if (text.includes('SALES')) return 'SALES';
    return 'SUPPORT';
  }

  /**
   * Ищет mcp_call с name=handoff_to_router в output.
   * Если найден — агент сам решил вернуть управление.
   */
  private detectHandoff(
    response: OpenAI.Responses.Response,
  ): { reason?: string } | null {
    for (const item of response.output ?? []) {
      if (item.type !== 'mcp_call') continue;
      if (item.name !== 'handoff_to_router') continue;

      // arguments может быть строкой JSON или объектом
      const args = (item as any).arguments;
      let reason: string | undefined;
      try {
        const parsed = typeof args === 'string' ? JSON.parse(args) : args;
        reason = parsed?.reason;
      } catch {
        // игнорируем парсинг
      }
      return { reason };
    }
    return null;
  }

  private async fallbackToSupport(
    userInput: string,
    sessionId: string,
    context?: SenderContext,
  ): Promise<string> {
    // Не даём зациклиться — эскалируем напрямую
    this.activeAgent.delete(sessionId);

    const agent = AGENTS.SUPPORT;
    const agentModel = this.resolveModel(agent.model ?? this.opts.model);
    const key = `${sessionId}:${agentModel}`;

    const contextLine = renderContextLine(context);
    const input = [contextLine, userInput].filter(Boolean).join('\n');

    const response = await this.opts.client.responses.create({
      model: agentModel,
      store: true,
      reasoning: { effort: 'low' },
      previous_response_id: this.sessions.get(key),
      instructions: agent.instructions,
      input,
    });

    this.sessions.set(key, response.id);
    const answer = this.extractText(response);

    if (this.opts.onEscalate) {
      await this.opts.onEscalate({
        userInput,
        botResponse: answer,
        sessionId,
        sender: context,
      });
    }

    return answer;
  }

  private filterTools(allowed: string[] | null): any[] {
    if (allowed === null) return [];
    return this.opts.mcpTools.map((tool) => ({
      ...tool,
      allowed_tools: allowed,
    }));
  }

  private smallTalk(input: string): string {
    const lower = input.toLowerCase();
    if (/(привет|здравств|хай|добрый)/.test(lower) && lower.length < 12) {
      return 'Привет! 🥁';
    }
    if (/(спасиб|благодар)/.test(lower) && lower.length < 10) {
      return 'Обращайся! 🥁';
    }
    return 'Помогаю только с расписанием и вопросами про школу. 🥁';
  }

  private logMcpCalls(response: OpenAI.Responses.Response): void {
    for (const item of response.output ?? []) {
      if (item.type !== 'mcp_call') continue;
      const err = 'error' in item ? item.error : undefined;
      console.log(`[MCP] ${item.server_label}/${item.name}${err ? ` — ${err}` : ''}`);
    }
  }

  private extractText(response: OpenAI.Responses.Response): string {
    const parts: string[] = [];
    for (const item of response.output ?? []) {
      if (item.type !== 'message') continue;
      for (const chunk of item.content ?? []) {
        if (chunk.type === 'output_text') parts.push(chunk.text);
      }
    }
    return parts.join('\n').trim() || response.output_text || '';
  }
}