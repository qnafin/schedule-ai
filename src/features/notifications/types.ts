import type { ScheduleConfig } from '../schedule/services/getSchedule';
import type { UsersConfig } from '../users/services/getUsers';
import type { NotifyChannel, VkRef } from '../users/user';
import type { Users } from '../users/services/getUsers';
import type { Lesson } from '../schedule/lesson';
import type { DaySchedule } from '../schedule/daySchedule';


export type NotificationRole = 'student' | 'teacher';

export type Notification = {
  date: string;             // ISO YYYY-MM-DD
  relativeDay: string;      // «Сегодня» / «Завтра» / «1 сентября»
  personId: string;
  fullName: string;
  role: NotificationRole;
  channel: NotifyChannel | null;
  vk: VkRef | null;
  phone: string;
  lessons: Lesson[];
  text: string;
};

export type Unresolved = {
  date: string;
  lessonId: string;
  role: NotificationRole;
  name: string;
};

export type NotificationPlan = {
  generatedAt: string;
  today: string;
  notifications: Notification[];
  unresolved: Unresolved[];
};

export type BuildNotificationsInput = {
  days: DaySchedule[];
  users: Users;
  today: string;
  greeting: string;
};

export type GetNotificationsOptions = {
  dates?: string[];
  today?: string;
};

export type NotificationsConfig = {
  spreadsheetId: string;
  schedule: ScheduleConfig['schedule'];
  users: UsersConfig['users'];
  notifications: { greeting: string };
  workHours: { from: string; to: string }
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

// ---------- Отчёт админу ----------

export type AdminReportInput = {
  adminUserId: number;
  /** Даты рассылки — для заголовка. */
  dates: string[];
  /** Итог по личным уведомлениям. */
  report: DeliveryReport;
  /** План — чтобы из personId достать имя. */
  plan: NotificationPlan;
  /** Опционально, для тестов. */
  nowTime?: string;
};

export type AdminReportResult =
  | { status: 'sent'; messageId: number; text: string }
  | { status: 'failed'; error: string; retryable: boolean; text: string };