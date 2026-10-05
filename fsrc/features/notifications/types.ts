import type { ScheduleConfig } from '../schedule/services/getSchedule';
import type { UsersConfig } from '../users/services/getUsers';
import type { Notification } from './notifications';


export type GetNotificationsOptions = {
  dates?: string[];
  today?: string;
};

export type NotificationsConfig = {
  spreadsheetId: string;
  schedule: ScheduleConfig['schedule'];
  users: UsersConfig['users'];
  notifications: { greeting: string };
};

// ---------- Доставка ----------

export type SkipReason = 'not-vk' | 'no-vk-link' | 'unresolved-screen';

export type DeliveryOutcome =
  | { status: 'sent'; personId: string; messageId: number }
  | { status: 'skipped'; personId: string; reason: SkipReason }
  | { status: 'failed'; personId: string; error: string; retryable: boolean };

export type DeliveryReport = {
  outcomes: DeliveryOutcome[];
  counts: { sent: number; skipped: number; failed: number };
};

/**
 * Порт отправки. Один метод — отправить одно уведомление.
 * Реализации: vkSender (сейчас), smsSender/telegramSender (позже).
 */
export type NotificationSender = {
  send(notification: Notification): Promise<DeliveryOutcome>;
};