import { VK } from 'vk-io';

import { buildClient } from '../assistant/shared/client';
import { Assistant } from '../assistant/single/assistant';
import { INSTRUCTIONS } from '../assistant/single/config';
import { buildMcpTools, buildModelUri} from '../assistant/shared'
import { createConfig } from '../config';
import { createGoogleAuth } from '../infrastructure/google/auth';
import { createBotDeps } from './deps';
import { createRouter } from './router';

const { client_email, private_key } = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}"
);

const main = async (): Promise<void> => {
  const token = process.env.VK_ACCESS_TOKEN;
  if (!token) throw new Error('VK_ACCESS_TOKEN не задан');

  const config = createConfig();
  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });

  const { client, folderId } = buildClient();
  const assistant = new Assistant({
    client,
    model: buildModelUri(folderId, process.env.YANDEX_CLOUD_MODEL),
    instructions: INSTRUCTIONS,
    tools: buildMcpTools(),
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
  console.log('🤖 Бот слушает. MCP:', buildMcpTools().map((t) => t.server_label).join(', '));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});