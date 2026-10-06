import { FastMCP } from '@prefecthq/fastmcp-ts/server';

import { createConfig } from '../config';
import { createGoogleAuth } from '../infrastructure/google/auth';
import { createVkClient } from '../infrastructure/vk'

import { registerUserTools } from '../features/users/mcp';
import { registerScheduleTools } from '../features/schedule/mcp';
import { registerNotificationTools } from '../features/notifications/mcp';

import {client_email, private_key} from '../../service_account.json' with { type: 'json' };

export const buildServer = (): FastMCP => {
  const config = createConfig();

  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });
  const vk =
    process.env.VK_ACCESS_TOKEN && process.env.VK_CHAT_PEER_ID
      ? createVkClient({ token: process.env.VK_ACCESS_TOKEN })
      : undefined;
  const server = new FastMCP({ name: 'schedule-ai', version: '0.1.0' });

  // Регистраторы фич. Новая фича — новая строка здесь.
  registerUserTools(server, { config, authClient });
  registerScheduleTools(server, { config, authClient });
    registerNotificationTools(server, {
    config,
    authClient,
    vk,
    chatPeerId: process.env.VK_CHAT_PEER_ID ?? undefined,
    adminUserId: process.env.VK_ADMIN_USER_ID ?? undefined,
  });
  
  return server;
};