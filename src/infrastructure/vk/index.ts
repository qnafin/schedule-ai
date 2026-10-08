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
  VkChatMessage,
  VkChatSendResult,
} from './sender';
export { sendVkMessage, sendVkToChat, clearVkScreenCache } from './sender';