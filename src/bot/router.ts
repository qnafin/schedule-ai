import type { MessageContext } from 'vk-io';
import type { Assistant } from '../assistant/assistant';
import { createDebouncer } from './debouncer';

export interface RouterDeps {
  assistant: Assistant;
  quietMs?: number;
  maxWaitMs?: number;
}

const sessionKey = (ctx: MessageContext): string =>
  `${ctx.peerId}:${ctx.senderId}`;

export const createRouter = ({ assistant, quietMs, maxWaitMs }: RouterDeps) => {
  const debouncer = createDebouncer({
    quietMs,
    maxWaitMs,
    onFlush: async (sessionId, texts) => {
      const input = texts.join('\n');
      const answer = await assistant.ask(input, sessionId);
      await send(sessionId, answer);
    },
  });

  // Реестр «как ответить в эту сессию» — чтобы debouncer не знал про vk-io
  const senders = new Map<string, (text: string) => Promise<void>>();

  const handle = async (ctx: MessageContext): Promise<void> => {
    const text = (ctx.text ?? '').trim();
    if (!text) return;

    const key = sessionKey(ctx);

    // Команды-исключения обрабатываем сразу, без буферизации
    if (text === '/reset') {
      await debouncer.flushNow(key);   // на всякий случай сбросим буфер
      assistant.resetSession(key);
      await ctx.send('Контекст сброшен.');
      return;
    }
   
    senders.set(key, (msg) => ctx.send(msg));
    debouncer.push(key, text);

  };

  const send = async (sessionId: string, text: string): Promise<void> => {
    const sender = senders.get(sessionId);
    if (!sender) return;
    await sender(text || 'Не смог подготовить ответ.');
  };

  return { handle };
};