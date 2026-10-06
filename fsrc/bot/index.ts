import { VK } from 'vk-io';
import { buildClient } from '../assistant/client.js';
import { Assistant } from '../assistant/assistant.js';
import { buildMcpTools, buildModelUri, INSTRUCTIONS } from '../assistant/config.js';
import { createRouter } from './router.js';

const main = async (): Promise<void> => {
  const token = process.env.VK_ACCESS_TOKEN;
  if (!token) throw new Error('VK_ACCESS_TOKEN не задан');

  const { client, folderId } = buildClient();

  const assistant = new Assistant({
    client,
    model: buildModelUri(folderId),
    instructions: INSTRUCTIONS,
    tools: buildMcpTools(),
  });

  const vk = new VK({ token, apiVersion: '5.199' });
  const router = createRouter({ assistant });

  vk.updates.on('message_new', async (context) => {
    if (context.isOutbox) return;

    // В беседах реагируем только на команды, начинающиеся со слэша
    if (context.isChat && !context.text?.startsWith('/')) return;

    try {
      await router.handle(context);
    } catch (e) {
      console.error('Ошибка обработки:', e);
      await context.send('Что-то пошло не так. Попробуйте позже.');
    }
  });

  await vk.updates.startPolling();
  console.log('🤖 Бот слушает сообщения. MCP:', buildMcpTools().map((t) => t.server_label).join(', '));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});