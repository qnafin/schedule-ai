import OpenAI from 'openai';

export interface ClientBundle {
  client: OpenAI;
  folderId: string;
}

export const buildClient = (): ClientBundle => {
  const folderId = process.env.YANDEX_CLOUD_FOLDER_ID;
  const apiKey = process.env.YANDEX_CLOUD_API_KEY;

  if (!folderId) throw new Error('YANDEX_CLOUD_FOLDER_ID не задан');
  if (!apiKey) throw new Error('YANDEX_CLOUD_API_KEY не задан');

  const client = new OpenAI({
    baseURL: 'https://ai.api.cloud.yandex.net/v1',
    apiKey,
    defaultHeaders: {
      'OpenAI-Project': folderId,
    },
  });

  return { client, folderId };
};