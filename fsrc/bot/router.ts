import type { MessageContext } from 'vk-io';
import type { Assistant } from '../assistant/assistant';

export interface RouterDeps {
  assistant: Assistant;
}

export const createRouter = ({ assistant }: RouterDeps) => {
  const handle = async (ctx: MessageContext): Promise<void> => {
    const text = (ctx.text ?? '').trim();

    if (!text) return;

    // Команда сброса контекста — единственное, что обрабатываем в обход ассистента
    if (text === '/reset') {
      assistant.resetSession(sessionKey(ctx));
      await ctx.send('Контекст сброшен.');
      return;
    }

    const answer = await assistant.ask(text, sessionKey(ctx));
    await ctx.send(answer || 'Не смог подготовить ответ.');
  };

  return { handle };
};

const sessionKey = (ctx: MessageContext): string =>
  `${ctx.peerId}:${ctx.senderId}`;