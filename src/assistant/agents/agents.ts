import {
  Agent,
  run,
  hostedMcpTool,
  MemorySession,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from '@openai/agents';
import type { Session } from '@openai/agents';
import OpenAI from 'openai';
import { renderContextLine, type SenderContext } from '../shared/context';
import {SMALLTALK_PROMPT, SCHEDULE_PROMPT, SUPPORT_PROMPT, KNOWLEDGE_PROMPT, SALES_PROMPT, TRIAGE_PROMPT} from './config'

export interface EscalationContext {
  userInput: string;
  botResponse: string;
  sessionId: string;
  sender?: SenderContext;
}

export interface AgentsAssistantOptions {
  apiKey: string;
  folderId: string;
  mcpUrl: string;
  /** Колбэк эскалации — вызывается, если финальный агент SupportAgent. */
  onEscalate?: (ctx: EscalationContext) => Promise<void>;
  /** Лог роутинга — какой агент ответил. */
  onRoute?: (agent: string, input: string) => void;
}


export class AgentsAssistant {
  /** Сессии per-user. Session хранит историю между запросами. */
  private readonly sessions = new Map<string, Session>();

  private readonly triage: Agent;

  constructor(private readonly opts: AgentsAssistantOptions) {
    
    setTracingDisabled(true);
    setDefaultOpenAIClient(
      new OpenAI({
        apiKey: opts.apiKey,
        baseURL: 'https://ai.api.cloud.yandex.net/v1',
        defaultHeaders: { 'OpenAI-Project': opts.folderId },
      }),
    );
    setOpenAIAPI('responses');

    const model = (m: string) => `gpt://${opts.folderId}/${m}/latest`;

    const mcp = (allowedTools: string[]) =>
      hostedMcpTool({
        serverLabel: 'schedule',
        serverUrl: opts.mcpUrl,
        requireApproval: 'never',
        allowedTools,
      });

    const schedule = new Agent({
      name: 'ScheduleAgent',
      model: model('deepseek-v4-flash'),
      instructions: SCHEDULE_PROMPT,
      tools: [
        mcp([
          'get_schedule',
          'list_schedule_dates',
          'append_lesson',
          'update_lesson',
          'delete_lesson',
          'list_students',
          'list_teachers',
          'list_rooms',
          'search_knowledge'
        ]),
      ],
      modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
    });

    const knowledge = new Agent({
      name: 'KnowledgeAgent',
      model: model('deepseek-v4-flash'),
      instructions: KNOWLEDGE_PROMPT,
      tools: [mcp(['search_knowledge'])],
      modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
    });

    const sales = new Agent({
      name: 'SalesAgent',
      model: model('deepseek-v4-flash'),
      instructions: SALES_PROMPT,
      tools: [
        mcp([
          'search_knowledge',
          'get_schedule',
          'append_lesson',
          'list_students',
        ]),
      ],
      modelSettings: { temperature: 0.5, reasoning: { effort: 'low' } },
    });

    const support = new Agent({
      name: 'SupportAgent',
      model: model('yandexgpt-lite'),
      instructions: SUPPORT_PROMPT,
      modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
    });

    const smalltalk = new Agent({
      name: 'SmalltalkAgent',
      model: model('yandexgpt-lite'),
      instructions: SMALLTALK_PROMPT,
      modelSettings: { temperature: 0.5 },
    });

    // Peer-to-peer handoffs
    schedule.handoffs = [knowledge, sales, support];
    knowledge.handoffs = [schedule, sales, support];
    sales.handoffs = [schedule, knowledge, support];
    // support и smalltalk — финальные, без исходящих handoff

    // 5. Triage — стартовый агент, handoffs ко всем
    this.triage = new Agent({
      name: 'TriageAgent',
      model: model('yandexgpt-lite'),
      instructions: TRIAGE_PROMPT,
      handoffs: [schedule, knowledge, sales, support, smalltalk],
      modelSettings: { temperature: 0, reasoning: { effort: 'low' } },
    });
  }


  async ask(
    userInput: string,
    sessionId = 'default',
    context?: SenderContext,
  ): Promise<string> {
    const session = this.getSession(sessionId);

    // [Сейчас: ...] + [Кто пишет: ...]
    const contextLine = renderContextLine(context);
    const input = contextLine
      ? `${contextLine}\n\n${userInput}`
      : userInput;

    try {
      const result = await run(this.triage, input, {
        session,
        maxTurns: 15,
      });

      const lastAgent = result.lastAgent?.name ?? 'Unknown';
      const answer = result.finalOutput?.trim() || 'Не смог ответить 🥁';

      this.opts.onRoute?.(lastAgent, userInput);

      // Эскалация — если финальный агент SupportAgent
      if (lastAgent === 'SupportAgent') {
        await this.escalate(userInput, answer, sessionId, context);
      }

      return answer;
    } catch (err) {
      console.error('[agents] error:', (err as Error).message);
      return 'Что-то пошло не так, попробуй переформулировать 🥁';
    }
  }

  resetSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private getSession(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new MemorySession();
      this.sessions.set(sessionId, session);
    }
    return session;
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
      console.log('[agents] эскалация админу');
    } catch (err) {
      console.warn(
        '[agents] escalation failed:',
        (err as Error).message,
      );
    }
  }
}