import { VK } from 'vk-io';

import {
  buildClient,
  buildModelUri,
  buildMcpTools,
} from '../assistant/shared';
import { MultiAgentAssistant } from '../assistant/multi';
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

  const adminUserId = Number(process.env.VK_ADMIN_USER_ID);
  if (!adminUserId) throw new Error('VK_ADMIN_USER_ID не задан');

  const config = createConfig();
  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });

  const { client, folderId } = buildClient();

  // Отдельный VkClient для исходящих (эскалация, уведомления)
  const vkClient = createVkClient({ token });

  const assistant = new MultiAgentAssistant({
    client,
    model: buildModelUri(folderId, process.env.YANDEX_CLOUD_MODEL),
    mcpTools: buildMcpTools(),

    onRoute: (role, input) => {
      console.log(`[route] "${input.slice(0, 50)}" → ${role}`);
    },

    onEscalate: async ({ userInput, botResponse, sessionId, sender }) => {
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
  const router = createRouter({ assistant, deps });

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
  console.log('🤖 Бот слушает (multi). MCP:', buildMcpTools().map((t) => t.server_label).join(', '));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});