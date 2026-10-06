import { VK } from 'vk-io';

import { createRouter } from './router';

const main = async () => {
  

  const vk = new VK({
    token: process.env.VK_ACCESS_TOKEN,
    apiVersion: '5.199',
  });

  const router = createRouter({ vk });

  vk.updates.on('message_new', async (context) => {
    // Игнорируем исходящие и сообщения от самого бота
    if (context.isOutbox) return;
   
    // Обрабатываем только личные сообщения или упоминания в чате
    if (context.isChat && !context.text?.startsWith('/')) return;
    console.log(context)
    try {
      await router.handle(context);
    } catch (e) {
      console.error('Ошибка обработки:', e);
      await context.send('Что-то пошло не так. Попробуйте позже.');
    }
  });

  await vk.updates.startPolling();
  console.log('🤖 Бот слушает сообщения');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});