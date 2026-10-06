import type { VkClient } from './client';
import { VkError } from './client';

// ---------- Личка ----------

export type VkRecipient =
  | { type: 'id'; value: number }
  | { type: 'screen'; value: string };

export type VkMessage = {
  to: VkRecipient;
  text: string;
  dedupKey?: string;
  randomId?: number;
};

export type VkSkipReason = 'unresolved-screen';

export type VkSendResult =
  | { status: 'sent'; messageId: number }
  | { status: 'skipped'; reason: VkSkipReason }
  | { status: 'failed'; error: string; retryable: boolean };

// ---------- Чат ----------

export type VkChatMessage = {
  peerId: number;
  text: string;
  dedupKey?: string;
  randomId?: number;
};

export type VkChatSendResult =
  | { status: 'sent'; messageId: number }
  | { status: 'failed'; error: string; retryable: boolean };

// ---------- Внутреннее ----------

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const screenCache = new Map<string, number>();

const resolveUserId = async (
  vk: VkClient,
  to: VkRecipient,
): Promise<{ id: number } | { skip: VkSkipReason }> => {
  if (to.type === 'id') return { id: to.value };
  const cached = screenCache.get(to.value);
  if (cached) return { id: cached };
  const resolved = await vk.resolveScreenName(to.value);
  if (!resolved) return { skip: 'unresolved-screen' };
  screenCache.set(to.value, resolved);
  return { id: resolved };
};

const toFailure = (err: unknown): { error: string; retryable: boolean } => {
  const vkErr = err instanceof VkError ? err : null;
  return {
    error: (err as Error).message,
    retryable: vkErr ? vkErr.retryable : true,
  };
};

const pickRandomId = (randomId?: number, dedupKey?: string): number =>
  randomId ?? (dedupKey ? hashString(dedupKey) : Date.now());

// ---------- Публичный API ----------

export const sendVkMessage = async (
  vk: VkClient,
  msg: VkMessage,
): Promise<VkSendResult> => {
  let resolved;
  try {
    resolved = await resolveUserId(vk, msg.to);
  } catch (err) {
    return { status: 'failed', ...toFailure(err) };
  }

  if ('skip' in resolved) {
    return { status: 'skipped', reason: resolved.skip };
  }

  try {
    const messageId = await vk.sendMessage({
      userId: resolved.id,
      text: msg.text,
      randomId: pickRandomId(msg.randomId, msg.dedupKey),
    });
    return { status: 'sent', messageId };
  } catch (err) {
    return { status: 'failed', ...toFailure(err) };
  }
};

export const sendVkToChat = async (
  vk: VkClient,
  msg: VkChatMessage,
): Promise<VkChatSendResult> => {
  try {
    const messageId = await vk.sendToChat({
      peerId: msg.peerId,
      text: msg.text,
      randomId: pickRandomId(msg.randomId, msg.dedupKey),
    });
    return { status: 'sent', messageId };
  } catch (err) {
    return { status: 'failed', ...toFailure(err) };
  }
};

/** Сбросить кэш screen-name → id. Для тестов. */
export const clearVkScreenCache = (): void => screenCache.clear();