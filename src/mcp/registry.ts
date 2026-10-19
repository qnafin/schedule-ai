import { FastMCP } from "fastmcp";

import { createConfig } from "../config";
import { createGoogleAuth } from "../infrastructure/google/auth";
import { createVkClient } from "../infrastructure/vk";

import { registerUserTools } from "../features/users/tool";
import { registerScheduleTools } from "../features/schedule/tool";
import { registerNotificationTools } from "../features/notifications/tool";
import { registerRoomsTools } from '../features/rooms/tool'
import { registerKnowledgeTool } from '../features/knowledge/tool';
import { registerHandoffTool } from './tools/handoff'

const { client_email, private_key } = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}"
);
const toNum = (v: string | undefined): number | undefined =>
  v ? Number(v) : undefined;

export const buildServer = (): FastMCP => {
  const config = createConfig();

  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });

  const vkToken = process.env.VK_ACCESS_TOKEN;
  const chatPeerId = toNum(process.env.VK_CHAT_PEER_ID);
  const adminUserId = toNum(process.env.VK_ADMIN_USER_ID);

  const vk = vkToken ? createVkClient({ token: vkToken }) : undefined;

  const server = new FastMCP({
    name: "schedule-ai",
    version: "0.1.0",
  });

  registerUserTools(server, { config, authClient });
  registerRoomsTools(server, { config, authClient });
  registerScheduleTools(server, { config, authClient });
  registerNotificationTools(server, {
    config,
    authClient,
    vk,
    chatPeerId,
    adminUserId,
  });
  registerKnowledgeTool(server);
  registerHandoffTool(server);

  return server;
};
