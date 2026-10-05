import { sendVkMessage } from '../../infrastructure/vk';
import type { VkClient } from '../../infrastructure/vk';
import type { DeliveryOutcome, NotificationSender, SkipReason } from './types';
import type { Notification } from './notifications';

const skipped = (personId: string, reason: SkipReason): DeliveryOutcome => ({
  status: 'skipped',
  personId,
  reason,
});

const dedupKey = (n: Notification): string =>
  `${n.personId}:${n.date}:${n.role}:${n.text}`;

export const createVkSender = (vk: VkClient): NotificationSender => ({
  async send(n: Notification): Promise<DeliveryOutcome> {
    if (n.channel !== 'vk') return skipped(n.personId, 'not-vk');
    if (!n.vk) return skipped(n.personId, 'no-vk-link');

    const result = await sendVkMessage(vk, {
      to: n.vk,
      text: n.text,
      dedupKey: dedupKey(n),
    });

    switch (result.status) {
      case 'sent':
        return { status: 'sent', personId: n.personId, messageId: result.messageId };
      case 'skipped':
        return skipped(n.personId, result.reason);
      case 'failed':
        return {
          status: 'failed',
          personId: n.personId,
          error: result.error,
          retryable: result.retryable,
        };
    }
  },
});