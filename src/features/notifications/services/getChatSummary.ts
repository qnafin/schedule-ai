import type { JWT } from 'google-auth-library';

import { todayIso } from '../../../shared/datetime';
import { getSchedule } from '../../schedule';
import { renderChatSummary, workHoursOf } from '../notifications';
import type {NotificationsConfig, GetNotificationsOptions} from "../types"

export const getChatSummary = async (
  config: NotificationsConfig,
  authClient: JWT,
  options: GetNotificationsOptions = {},
): Promise<string> => {
  const days = await getSchedule(config, authClient, { dates: options.dates });
   
  return renderChatSummary(days, options.today ?? todayIso(), workHoursOf(config));
};