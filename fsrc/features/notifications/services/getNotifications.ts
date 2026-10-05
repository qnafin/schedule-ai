import type { JWT } from 'google-auth-library';
import { todayIso } from '../../../shared/datetime';
import { getSchedule } from '../../schedule';
import { getUsers } from '../../users';
import { buildNotifications,  } from '../notifications';
import type { NotificationPlan } from '../notifications';
import type {NotificationsConfig, GetNotificationsOptions} from "../types"

export const getNotifications = async (
  config: NotificationsConfig,
  authClient: JWT,
  options: GetNotificationsOptions = {},
): Promise<NotificationPlan> => {
  const [days, users] = await Promise.all([
    getSchedule(config, authClient, { dates: options.dates }),
    getUsers(config, authClient),
  ]);

  return buildNotifications({
    days,
    users,
    today: options.today ?? todayIso(),
    greeting: config.notifications.greeting,
  });
};