import type { VkClient } from './client';
import { VkError } from './client';

// Структурно совместим с `VkRef` из users, но infrastructure не зависит от домена.
export type VkRecipient =
  | { type: 'id'; value: number }
  | { type: 'screen'; value: string };

export type VkMessage = {
  to: VkRecipient;
  text: string;
  /** Idempotency key. Если задан — из него делается random_id. */
  dedupKey?: string;
  /** Перебивает dedupKey, если нужен явный random_id. */
  randomId?: number;
};

export type VkSkipReason = 'unresolved-screen';

export type VkSendResult =
  | { status: 'sent'; messageId: number }
  | { status: 'skipped'; reason: VkSkipReason }
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

const toFailure = (err: unknown): VkSendResult => {
  const vkErr = err instanceof VkError ? err : null;
  return {
    status: 'failed',
    error: (err as Error).message,
    retryable: vkErr ? vkErr.retryable : true,
  };
};

// ---------- Публичный API ----------

export const sendVkMessage = async (
  vk: VkClient,
  msg: VkMessage,
): Promise<VkSendResult> => {
  let resolved;
  try {
    resolved = await resolveUserId(vk, msg.to);
  } catch (err) {
    return toFailure(err);
  }

  if ('skip' in resolved) {
    return { status: 'skipped', reason: resolved.skip };
  }

  const randomId =
    msg.randomId ?? (msg.dedupKey ? hashString(msg.dedupKey) : Date.now());

  try {
    const messageId = await vk.sendMessage({
      userId: resolved.id,
      text: msg.text,
      randomId,
    });
    return { status: 'sent', messageId };
  } catch (err) {
    return toFailure(err);
  }
};

/** Сбросить кэш screen-name → id. Для тестов и ручной инвалидации. */
export const clearVkScreenCache = (): void => {
  screenCache.clear();
};