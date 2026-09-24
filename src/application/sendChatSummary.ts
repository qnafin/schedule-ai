// src/application/sendChatSummary.js
import { createHash } from 'node:crypto';
import { renderChatSummary } from '../domain/notifications.js';

const hashCode = (str) => {
  const buf = createHash('sha256').update(str).digest();
  return Number(buf.readBigUInt64BE(0) % 9223372036854775807n) || 1;
};

export const createSendChatSummary = ({ vkClient, journal }) =>
  async ({ days, runDate, peerId }) => {
    if (!peerId) {
      return { skipped: true, reason: 'chatPeerId не настроен' };
    }

    const key = `chat:${runDate}`;

    const previous = await journal.load();
    if (previous.has(key)) {
      return { skipped: true, reason: 'already sent' };
    }

    const text = renderChatSummary(days);

    try {
      await vkClient.sendToChat({
        peerId,
        text,
        randomId: hashCode(key),
      });
    } catch (e) {
      return { sent: false, error: e.message };
    }

    const current = new Set(previous);
    current.add(key);
    await journal.save(current);

    return { sent: true, peerId, text };
  };