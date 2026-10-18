export const MODEL_FLASH = 'deepseek-v4-flash';
export const MODEL_ROUTER = 'yandexgpt-lite/latest';

export const buildModelUri = (
  folderId: string,
  model: string = MODEL_FLASH,
): string => `gpt://${folderId}/${model}/latest`;