import { VK } from 'vk-io';

import { AgentsAssistant } from '../assistant/agents';
import { createConfig } from '../config';
import { createGoogleAuth } from '../infrastructure/google/auth';
import { createVkClient } from '../infrastructure/vk';
import { sendAdminEscalation } from '../features/notifications';
import { createBotDeps } from './deps';
import { createRouter } from './router';

const { client_email, private_key } = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}',
);

const main = async (): Promise<void> => {
  const token = process.env.VK_ACCESS_TOKEN;
  if (!token) throw new Error('VK_ACCESS_TOKEN не задан');

  const apiKey = process.env.YANDEX_CLOUD_API_KEY;
  const folderId = process.env.YANDEX_CLOUD_FOLDER_ID;
  const mcpUrl = process.env.MCP_URL_SSE;

  if (!apiKey || !folderId) {
    throw new Error('YANDEX_CLOUD_API_KEY / FOLDER_ID не заданы');
  }
  if (!mcpUrl) {
    throw new Error('MCP_URL_SSE не задан');
  }

  const adminUserId = Number(process.env.VK_ADMIN_USER_ID) || null;

  const config = createConfig();
  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });

  const vkClient = createVkClient({ token });

  const assistant = new AgentsAssistant({
    apiKey,
    folderId,
    mcpUrl,
    onRoute: (agent, input) => {
      console.log(`[route] "${input.slice(0, 50)}" → ${agent}`);
    },
    onEscalate: async ({ userInput, botResponse, sessionId, sender }) => {
      if (!adminUserId) {
        console.warn('[escalation] VK_ADMIN_USER_ID не задан — пропускаем');
        return;
      }

      const result = await sendAdminEscalation(vkClient, {
        adminUserId,
        userInput,
        botResponse,
        sessionId,
        senderVkId: sender?.vkId,
        senderName: sender?.user?.fullName,
        senderRole: sender?.user?.role,
      });

      if (result.status === 'failed') {
        console.warn('[escalation] failed:', result.error);
      }
    },
  });

  const deps = createBotDeps(config, authClient);
  const vk = new VK({ token, apiVersion: '5.199' });
  const router = createRouter({ assistant, deps, quietMs: 1000 });

  vk.updates.on('message_new', async (context) => {
    if (context.isOutbox) return;
    if (context.isChat && !context.text?.startsWith('/')) return;

    try {
      await router.handle(context);
    } catch (e) {
      console.error('Ошибка обработки:', e);
      await context.send('Что-то пошло не так. Попробуйте позже.');
    }
  });

  await vk.updates.startPolling();
  console.log('🤖 Бот слушает (agents SDK). MCP:', mcpUrl);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});