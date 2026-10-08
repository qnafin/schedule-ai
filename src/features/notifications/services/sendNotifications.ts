import type {
  DeliveryOutcome,
  DeliveryReport,
  NotificationSender,
} from '../types';
import type { NotificationPlan } from '../notifications';

const summarize = (
  outcomes: DeliveryOutcome[],
): DeliveryReport['counts'] => ({
  sent: outcomes.filter((o) => o.status === 'sent').length,
  skipped: outcomes.filter((o) => o.status === 'skipped').length,
  failed: outcomes.filter((o) => o.status === 'failed').length,
});

/**
 * Отправить все уведомления из плана через переданный sender.
 * Возвращает отчёт: список исходов + агрегаты.
 * Сама функция чистая — вся сеть в sender'е.
 */
export const sendNotifications = async (
  plan: NotificationPlan,
  sender: NotificationSender,
): Promise<DeliveryReport> => {
  const outcomes = await Promise.all(
    plan.notifications.map((n) => sender.send(n)),
  );
  return { outcomes, counts: summarize(outcomes) };
};