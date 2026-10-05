// /infrastructure/vk/client.ts
const VK_API = 'https://api.vk.com/method';

const RETRYABLE_CODES = new Set([1, 6, 10]);

export type VkErrorBody = {
  error_code: number;
  error_msg: string;
};

export class VkError extends Error {
  readonly code: number;
  readonly retryable: boolean;
  readonly raw: VkErrorBody;

  constructor(method: string, body: VkErrorBody) {
    super(`VK ${method}: ${body.error_msg}`);
    this.name = 'VkError';
    this.code = body.error_code;
    this.retryable = RETRYABLE_CODES.has(body.error_code);
    this.raw = body;
  }
}

export type VkClientOptions = {
  token: string;
  version?: string;
};

export type SendMessageParams = {
  userId: number;
  text: string;
  randomId?: number;
};

export type SendToChatParams = {
  peerId: number;
  text: string;
  randomId?: number;
};

export type VkClient = {
  resolveScreenName(screenName: string): Promise<number | null>;
  sendMessage(params: SendMessageParams): Promise<number>;
  sendToChat(params: SendToChatParams): Promise<number>;
};

export const createVkClient = ({
  token,
  version = '5.199',
}: VkClientOptions): VkClient => {
  if (!token) throw new Error('VK_ACCESS_TOKEN не задан');

  const call = async <T>(
    method: string,
    params: Record<string, string>,
  ): Promise<T> => {
    const body = new URLSearchParams({
      ...params,
      access_token: token,
      v: version,
    });

    const res = await fetch(`${VK_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await res.json()) as {
      response?: T;
      error?: VkErrorBody;
    };

    if (data.error) throw new VkError(method, data.error);
    return data.response as T;
  };

  return {
    resolveScreenName: async (screenName) => {
      const users = await call<Array<{ id: number }>>('users.get', {
        user_ids: screenName,
      });
      return users?.[0]?.id ?? null;
    },

    sendMessage: ({ userId, text, randomId }) =>
      call<number>('messages.send', {
        user_id: String(userId),
        message: text,
        random_id: String(randomId ?? Date.now()),
      }),

    sendToChat: ({ peerId, text, randomId }) =>
      call<number>('messages.send', {
        peer_id: String(peerId),
        message: text,
        random_id: String(randomId ?? Date.now()),
      }),
  };
};