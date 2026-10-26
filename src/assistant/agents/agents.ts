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
import {
  SMALLTALK_PROMPT,
  SCHEDULE_PROMPT,
  SUPPORT_PROMPT,
  KNOWLEDGE_PROMPT,
  SALES_PROMPT,
  TRIAGE_PROMPT,
} from './config';

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
  onEscalate?: (ctx: EscalationContext) => Promise<void>;
  onRoute?: (agent: string, input: string) => void;
}

const MAX_TURNS = 30;

export class AgentsAssistant {
  private readonly sessions = new Map<string, Session>();

  private readonly lastAgents = new Map<string, Agent>();

  private readonly triage: Agent;
  private readonly schedule: Agent;
  private readonly knowledge: Agent;
  private readonly sales: Agent;
  private readonly support: Agent;
  private readonly smalltalk: Agent;

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

    this.schedule = new Agent({
      name: 'ScheduleAgent',
      model: model('deepseek-v4-flash'),
      instructions: SCHEDULE_PROMPT,
      tools: [
        mcp([
          'get_schedule',
          'append_lesson',
          'update_lesson',
          'delete_lesson',
          'list_students',
          'list_teachers',
          'list_rooms',
          'search_knowledge',
        ]),
      ],
      modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
    });

    this.knowledge = new Agent({
      name: 'KnowledgeAgent',
      model: model('deepseek-v4-flash'),
      instructions: KNOWLEDGE_PROMPT,
      tools: [mcp(['search_knowledge'])],
      modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
    });

    this.sales = new Agent({
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

    this.support = new Agent({
      name: 'SupportAgent',
      model: model('yandexgpt-lite'),
      instructions: SUPPORT_PROMPT,
      modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
    });

    this.smalltalk = new Agent({
      name: 'SmalltalkAgent',
      model: model('yandexgpt-lite'),
      instructions: SMALLTALK_PROMPT,
      modelSettings: { temperature: 0.5 },
    });

    // Peer-to-peer handoffs
    this.schedule.handoffs = [this.knowledge, this.sales, this.support];
    this.knowledge.handoffs = [this.schedule, this.sales, this.support];
    this.sales.handoffs = [this.schedule, this.knowledge, this.support];
    // support и smalltalk — финальные, без исходящих handoff

    // Triage — стартовый агент, handoffs ко всем
    this.triage = new Agent({
      name: 'TriageAgent',
      model: model('deepseek-v4-flash'),
      instructions: TRIAGE_PROMPT,
      handoffs: [
        this.schedule,
        this.knowledge,
        this.sales,
        this.support,
        this.smalltalk,
      ],
      modelSettings: { temperature: 0, reasoning: { effort: 'low' } },
    });
  }


  async ask(
    userInput: string,
    sessionId = 'default',
    context?: SenderContext,
  ): Promise<string> {
    const session = this.getSession(sessionId);
    const contextLine = renderContextLine(context);
    const input = contextLine
      ? `${contextLine}\n\n${userInput}`
      : userInput;

    // ★ Стартуем с последнего агента диалога
    const startAgent = this.lastAgents.get(sessionId) ?? this.triage;
    console.log(`[start] → ${startAgent.name}`);

    try {
      const result = await run(startAgent, input, {
        session,
        maxTurns: MAX_TURNS,
      });

      const lastAgent = result.lastAgent;
      const lastAgentName = lastAgent?.name ?? 'Unknown';
      let answer = result.finalOutput?.trim() ?? '';

      if (lastAgent) {
        this.lastAgents.set(sessionId, lastAgent);
      }

      this.opts.onRoute?.(lastAgentName, userInput);

      // Эскалация — если финальный агент SupportAgent
      if (lastAgentName === 'SupportAgent') {
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
    this.lastAgents.delete(sessionId);  // ★ чистим оба
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