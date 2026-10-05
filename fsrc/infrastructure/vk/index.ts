export type {
  VkClient,
  VkClientOptions,
  VkErrorBody,
  SendMessageParams,
  SendToChatParams,
} from './client';
export { createVkClient, VkError } from './client';

export type {
  VkRecipient,
  VkMessage,
  VkSendResult,
  VkSkipReason,
} from './sender';
export { sendVkMessage, clearVkScreenCache } from './sender';