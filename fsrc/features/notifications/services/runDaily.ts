import type { JWT } from 'google-auth-library';

import {
  addDays,
  nowTime as currentTime,
  todayIso,
} from '../../../shared/datetime';
import type { VkClient } from '../../../infrastructure/vk';
import { getNotifications } from './getNotifications';
import { sendNotifications } from './sendNotifications';
import { sendChatSummary } from './sendChatSummary';
import { sendAdminReport } from './sendAdminReport';
import { createVkSender } from '../vkSender';
import type {
  AdminReportResult,
  DeliveryReport,
  NotificationsConfig,
  SendChatSummaryResult,
} from '../types';
import type { Unresolved } from '../types';

export type RunDailyOptions = {
  /** Для отчёта админу. Если не задан — отчёт не отправляется. */
  adminUserId?: number;
  /** Для сводки в чат. Если не задан — в чат не отправляется. */
  chatPeerId?: number;
  dates?: string[];
  today?: string;
  nowTime?: string;
  /** Что запускать. По умолчанию — всё, что сконфигурировано. */
  scope?: 'all' | 'users' | 'chat';
  /** Только построить, ничего не отправлять. */
  dryRun?: boolean;
};

export type RunDailyResult = {
  today: string;
  dates: string[];
  unresolved: Unresolved[];
  /** Отчёт по ЛС. null, если scope его не включал или dryRun. */
  personal: DeliveryReport | null;
  /** Отчёт админу. null, если adminUserId не задан или scope='chat'. */
  admin: AdminReportResult | null;
  /** Результат отправки сводки в чат. null, если scope='users' или chatPeerId не задан. */
  chat: SendChatSummaryResult | null;
};

export const runDaily = async (
  config: NotificationsConfig,
  authClient: JWT,
  vk: VkClient,
  options: RunDailyOptions,
): Promise<RunDailyResult> => {
  const today = options.today ?? todayIso();
  const nowTime = options.nowTime ?? currentTime();
  const dates = options.dates ?? [today, addDays(today, 1)];
  const scope = options.scope ?? 'all';

  const plan = await getNotifications(config, authClient, {
    dates,
    today,
    nowTime,
  });

  // ---------- Dry-run: ничего не отправляем ----------

  if (options.dryRun) {
    return {
      today,
      dates,
      unresolved: plan.unresolved,
      personal: null,
      admin: null,
      chat: null,
    };
  }

  // ---------- ЛС ----------

  let personal: DeliveryReport | null = null;
  if (scope === 'all' || scope === 'users') {
    personal = await sendNotifications(plan, createVkSender(vk));
  }

  // ---------- Отчёт админу (только если был ЛС и есть кому) ----------

  let admin: AdminReportResult | null = null;
  if (personal && options.adminUserId) {
    admin = await sendAdminReport(vk, {
      adminUserId: options.adminUserId,
      dates,
      report: personal,
      plan,
    });
  }

  // ---------- Сводка в чат ----------

  let chat: SendChatSummaryResult | null = null;
  if ((scope === 'all' || scope === 'chat') && options.chatPeerId) {
    chat = await sendChatSummary(config, authClient, vk, {
      peerId: options.chatPeerId,
      dates,
      today,
      nowTime,
    });
  }

  return {
    today,
    dates,
    unresolved: plan.unresolved,
    personal,
    admin,
    chat,
  };
};