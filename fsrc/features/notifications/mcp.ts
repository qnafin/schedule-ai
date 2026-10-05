// /features/notifications/mcp.ts
import { z } from 'zod';
import type { FastMCP } from '@prefecthq/fastmcp-ts/server';
import type { JWT } from 'google-auth-library';

import { getChatSummary, getNotifications} from './';

import type { NotificationsConfig } from './types';

type Deps = { config: NotificationsConfig; authClient: JWT };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const datesSchema = z.array(z.string().regex(ISO_DATE)).optional();
const todaySchema = z.string().regex(ISO_DATE).optional();

export const registerNotificationTools = (
  server: FastMCP,
  { config, authClient }: Deps,
) => {
  server.tool(
    {
      name: 'get_notifications',
      description:
        'План уведомлений на указанные даты. Возвращает список сообщений: ' +
        'для каждого человека — текст с его занятиями.',
      input: z.object({ dates: datesSchema, today: todaySchema }),
    },
    async ({ dates, today }) =>
      JSON.stringify(
        await getNotifications(config, authClient, { dates, today }),
        null,
        2,
      ),
  );

  server.tool(
    {
      name: 'get_chat_summary',
      description: 'Сводка свободных слотов по классам — для публикации в чат.',
      input: z.object({ dates: datesSchema, today: todaySchema }),
    },
    async ({ dates, today }) =>
      getChatSummary(config, authClient, { dates, today }),
  );
};