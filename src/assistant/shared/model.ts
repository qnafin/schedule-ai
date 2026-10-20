export const MODEL_FLASH = 'deepseek-v4-flash';
export const MODEL_ROUTER = 'yandexgpt-lite';

export const buildModelUri = (
  folderId: string,
  model: string = MODEL_FLASH,
): string => {
  if (!folderId) {
    throw new Error('buildModelUri: folderId не задан');
  }
  if (model.startsWith('gpt://')) {
    throw new Error(
      `buildModelUri: ожидается короткое имя модели, получен URI "${model}"`,
    );
  }
  return `gpt://${folderId}/${model}/latest`;
};