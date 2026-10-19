import { sendVkMessage } from '../../../infrastructure/vk';
import type { VkClient } from '../../../infrastructure/vk';

export type EscalationInput = {
  adminUserId: number;
  userInput: string;
  botResponse: string;
  sessionId: string;
  senderVkId?: number;
  senderName?: string;
  senderRole?: string;
};

export type EscalationResult =
  | { status: 'sent'; messageId: number }
  | { status: 'failed'; error: string };

export const sendAdminEscalation = async (
  vk: VkClient,
  input: EscalationInput,
): Promise<EscalationResult> => {
  const lines: string[] = ['⚠️ Нужна помощь'];

  if (input.senderName) {
    lines.push(`От: ${input.senderName}${input.senderRole ? ` (${input.senderRole})` : ''}`);
  } else if (input.senderVkId) {
    lines.push(`От: vk_id=${input.senderVkId} (не в справочнике)`);
  }

  lines.push(`Вопрос: "${input.userInput}"`);
  lines.push(`Бот ответил: "${input.botResponse}"`);

  const text = lines.join('\n');

  const result = await sendVkMessage(vk, {
    to: { type: 'id', value: input.adminUserId },
    text,
    dedupKey: `escalation:${input.sessionId}:${input.userInput.slice(0, 100)}`,
  });

  if (result.status === 'sent') {
    return { status: 'sent', messageId: result.messageId };
  }

  return {
    status: 'failed',
    error: result.status === 'failed' ? result.error : result.reason,
  };
};