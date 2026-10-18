import type OpenAI from 'openai';
import { renderContextLine, type SenderContext } from '../shared/context';
import { buildRagContext } from '../../features/knowledge';
import {
  AGENTS,
  ROUTER_PROMPT,
  type AgentRole,
} from './config';

export type { SenderContext };

export interface EscalationContext {
  userInput: string;
  botResponse: string;
  sessionId: string;
  sender?: SenderContext;
}

export interface MultiAgentOptions {
  client: OpenAI;
  model: string;
  mcpTools: any[];
  onEscalate?: (ctx: EscalationContext) => Promise<void>;
  onRoute?: (role: AgentRole | 'SMALLTALK', input: string) => void;
}

export class MultiAgentAssistant {
  private readonly sessions = new Map<string, string>();

  constructor(private readonly opts: MultiAgentOptions) {}

  async ask(
    userInput: string,
    sessionId = 'default',
    context?: SenderContext,
  ): Promise<string> {
    const role = await this.classify(userInput);
    this.opts.onRoute?.(role, userInput);
    console.log(`[router] → ${role}`);

    if (role === 'SMALLTALK') {
      return this.smallTalk(userInput);
    }

    const agent = AGENTS[role];

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

    const response = await this.opts.client.responses.create({
      model: this.opts.model,
      store: true,
      reasoning: { effort: 'low' },
      previous_response_id: this.sessions.get(sessionId),
      instructions: agent.instructions,
      input,
      ...(tools.length > 0 && { tools, tool_choice: 'auto' }),
    });

    this.sessions.set(sessionId, response.id);
    this.logMcpCalls(response);

    const answer = this.extractText(response);

    if (agent.escalate && this.opts.onEscalate) {
      try {
        await this.opts.onEscalate({ userInput, botResponse: answer, sessionId, sender: context });
        console.log('[support] эскалация админу');
      } catch (err) {
        console.warn('[support] escalation failed:', (err as Error).message);
      }
    }

    return answer;
  }

  resetSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private async classify(input: string): Promise<AgentRole | 'SMALLTALK'> {
    const response = await this.opts.client.responses.create({
      model: this.opts.model,
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

  private filterTools(allowed: string[] | null): any[] {
    if (allowed === null) return [];
    return this.opts.mcpTools.map((tool) => ({ ...tool, allowed_tools: allowed }));
  }

  private smallTalk(input: string): string {
    const lower = input.toLowerCase();
    if (/(привет|здравств|хай|добрый)/.test(lower)) {
      return 'Привет! Помогу с расписанием, записью и вопросами про школу. 🥁';
    }
    if (/(спасиб|благодар)/.test(lower)) {
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