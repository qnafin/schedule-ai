import type { MessageContext } from 'vk-io';
import type { SenderContext } from '../assistant/shared/context';
import type { Sender } from '../features/users/services/resolveByVkId';
import type { BotDeps } from './deps';
import { createDebouncer } from './debouncer';

export interface AssistantLike {
  ask(
    input: string,
    sessionId?: string,
    context?: SenderContext,
  ): Promise<string>;
  resetSession(sessionId: string): void;
}

export interface RouterDeps {
  assistant: AssistantLike;
  deps: BotDeps;
  quietMs?: number;
  maxWaitMs?: number;
}

const sessionKey = (ctx: MessageContext): string =>
  `${ctx.peerId}:${ctx.senderId}`;

export const createRouter = ({
  assistant,
  deps,
  quietMs,
  maxWaitMs,
}: RouterDeps) => {
  const senders = new Map<string, (text: string) => Promise<void>>();

  const debouncer = createDebouncer<SenderContext>({
    quietMs,
    maxWaitMs,
    onFlush: async (sessionId, texts, context) => {
      const input = texts.join('\n');
      const answer = await assistant.ask(input, sessionId, context);
      await send(sessionId, answer);
    },
  });

  const handle = async (ctx: MessageContext): Promise<void> => {
    const text = (ctx.text ?? '').trim();
    if (!text) return;

    const key = sessionKey(ctx);

    if (text === '/reset') {
      await debouncer.flushNow(key);
      assistant.resetSession(key);
      await ctx.send('Контекст сброшен.');
      return;
    }

    let user: Sender | null = null;
    try {
      user = await deps.resolveSender(ctx.senderId);
    } catch (e) {
      console.error('[router] resolveSender failed:', e);
    }

    const context: SenderContext = {
      vkId: ctx.senderId,
      user,
    };

    senders.set(key, (msg) => ctx.send(msg));
    debouncer.push(key, text, context);
  };

  const send = async (sessionId: string, text: string): Promise<void> => {
    const sender = senders.get(sessionId);
    if (!sender) return;
    await sender(text || 'Не смог подготовить ответ.');
  };

  return { handle };
};