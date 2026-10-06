import { z } from 'zod';
import type { FastMCP } from '@prefecthq/fastmcp-ts/server';
import type { JWT } from 'google-auth-library';

import type { VkClient } from '../../infrastructure/vk';
import { getNotifications } from './services/getNotifications';
import { getChatSummary } from './services/getChatSummary';
import { sendNotifications } from './services/sendNotifications';
import { sendChatSummary } from './services/sendChatSummary';
import { sendAdminReport } from './services/sendAdminReport';
import { runDaily } from './services/runDaily';
import { createVkSender } from './vkSender';
import type { NotificationsConfig } from './types';

type Deps = {
  config: NotificationsConfig;
  authClient: JWT;
  vk?: VkClient;
  chatPeerId?: number | undefined;
  adminUserId?: number | undefined;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const datesSchema = z.array(z.string().regex(ISO_DATE)).optional();
const todaySchema = z.string().regex(ISO_DATE).optional();
const confirmSchema = z
  .literal(true)
  .describe('Обязательное подтверждение необратимой отправки.');

export const registerNotificationTools = (
  server: FastMCP,
  { config, authClient, vk, chatPeerId, adminUserId }: Deps,
) => {
  // ---------- Read ----------

  server.tool(
    {
      name: 'get_notifications',
      description:
        'План уведомлений на указанные даты. Прошедшие уроки не показываются.',
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
      description: 'Сводка свободных слотов по классам для просмотра.',
      input: z.object({ dates: datesSchema, today: todaySchema }),
    },
    async ({ dates, today }) =>
      getChatSummary(config, authClient, { dates, today }),
  );

  if (!vk) return;

  // ---------- Send: ЛС + отчёт админу ----------

  server.tool(
    {
      name: 'send_personal_notifications',
      description:
        'Разослать ЛИЧНЫЕ уведомления о занятиях в VK (сегодня и завтра по ' +
        'умолчанию). Если задан VK_ADMIN_USER_ID — админу уйдёт отчёт о том, ' +
        'кто не получил и почему. НЕОБРАТИМАЯ ОПЕРАЦИЯ.',
      input: z.object({
        dates: datesSchema.describe('Если не указано — сегодня и завтра.'),
        confirm: confirmSchema,
      }),
    },
    async ({ dates }) => {
      const plan = await getNotifications(config, authClient, { dates });
      const report = await sendNotifications(plan, createVkSender(vk));

      let admin = null;
      if (adminUserId) {
        admin = await sendAdminReport(vk, {
          adminUserId,
          dates: dates ?? [plan.today],
          report,
          plan,
        });
      }

      return JSON.stringify(
        { personal: report, admin },
        null,
        2,
      );
    },
  );

  // ---------- Send: сводка в чат ----------

  if (chatPeerId) {
    server.tool(
      {
        name: 'send_chat_summary',
        description:
          'Отправить в VK-чат сводку свободных слотов для РЕПЕТИЦИЙ (сегодня и завтра ' +
          'по умолчанию, прошедшие слоты исключены). Идемпотентно.',
        input: z.object({
          dates: datesSchema,
          confirm: confirmSchema,
        }),
      },
      async ({ dates }) => {
        const result = await sendChatSummary(config, authClient, vk, {
          peerId: chatPeerId,
          dates,
        });
        return JSON.stringify(result, null, 2);
      },
    );
  }

  server.tool(
    {
      name: 'run_daily',
      description:
        'ЗАПУСТИТЬ полный цикл: ЛС всем по предстоящим урокам + отчёт админу + сводка по репетициям в чат. ' +
        'НЕОБРАТИМАЯ ОПЕРАЦИЯ. Вызывай только по явной просьбе пользователя. ' +
        'Для предпросмотра используй dryRun: true.',
      input: z.object({
        scope: z
          .enum(['all', 'users', 'chat'])
          .optional()
          .describe('all по умолчанию.'),
        dates: datesSchema,
        dryRun: z.boolean().optional(),
        confirm: confirmSchema,
      }),
    },
    async ({ scope, dates, dryRun }) => {
      const result = await runDaily(config, authClient, vk, {
        adminUserId,
        chatPeerId,
        scope,
        dates,
        dryRun,
      });
      return JSON.stringify(result, null, 2);
    },
  );
};