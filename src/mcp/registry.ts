import { FastMCP } from "fastmcp";

import { createConfig } from "../config";
import { createGoogleAuth } from "../infrastructure/google/auth";
import { createVkClient } from "../infrastructure/vk";

import { registerUserTools } from "../features/users/mcp";
import { registerScheduleTools } from "../features/schedule/mcp";
import { registerNotificationTools } from "../features/notifications/mcp";
import { registerRoomsTools } from '../features/rooms/mcp'

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

  return server;
};
