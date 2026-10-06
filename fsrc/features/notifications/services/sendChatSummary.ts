import type { JWT } from 'google-auth-library';

import { addDays, nowTime as currentTime, todayIso } from '../../../shared/datetime';

import { sendVkToChat } from '../../../infrastructure/vk';
import type { VkClient } from '../../../infrastructure/vk';
import { getSchedule } from '../../schedule';
import { renderChatSummary, workHoursOf } from '../notifications';
import type { NotificationsConfig, GetNotificationsOptions } from '../types';

export type SendChatSummaryOptions = GetNotificationsOptions & {
  /** Кому шлём в VK. Обычно — env.VK_CHAT_PEER_ID. */
  peerId: number;
  
};

export type SendChatSummaryResult =
  | { status: 'sent'; messageId: number; text: string }
  | { status: 'failed'; error: string; retryable: boolean; text: string };

/**
 * Строит чат-сводку (по умолчанию — сегодня + завтра, без прошедшего)
 * и отправляет её в VK-чат. Идемпотентно через random_id.
 */
export const sendChatSummary = async (
  config: NotificationsConfig,
  authClient: JWT,
  vk: VkClient,
  options: SendChatSummaryOptions,
): Promise<SendChatSummaryResult> => {
  const today = options.today ?? todayIso();
  const nowTime = options.nowTime ?? currentTime();

  const days = await getSchedule(config, authClient, {
    dates: options.dates ?? [today, addDays(today, 1)],
  });

 
  const text = renderChatSummary(days, today, workHoursOf(config));

  const result = await sendVkToChat(vk, {
    peerId: options.peerId,
    text,
    dedupKey: `chat-summary:${options.peerId}:${today}:${nowTime}:${text}`,
  });

  if (result.status === 'sent') {
    return { status: 'sent', messageId: result.messageId, text };
  }
  return {
    status: 'failed',
    error: result.error,
    retryable: result.retryable,
    text,
  };
};