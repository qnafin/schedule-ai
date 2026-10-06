export const createRouter = ({ vk, config }) => {
  const commands = new Map();

  const register = (pattern, handler) => {
    commands.set(pattern, handler);
  };

  // Регистрация команд
  register(/^\/help$/i, async (ctx) => {
    await ctx.send([
      'Доступные команды:',
      '/расписание ДД.ММ.ГГГГ — показать расписание на день',
      '/свободно ДД.ММ.ГГГГ — свободные слоты',
      '/отмена ID — отменить урок',
      '/статус — последний отчёт рассылки',
    ].join('\n'));
  });

  register(/^\/расписание\s+(\d{2}\.\d{2}\.\d{4})$/i, async (ctx, date) => {
    // Здесь можно использовать ваш domain/buildScheduleForDates
    await ctx.send(`Расписание на ${date} — заглушка. Скоро будет.`);
  });

  register(/^\/отмена\s+(ID-\d+)$/i, async (ctx, id) => {
    await ctx.send(`Отмена урока ${id} — заглушка. Требует подтверждения.`);
  });

  register(/^\/статус$/i, async (ctx) => {
    await ctx.send('Последняя рассылка: успешно, 7 отправлено, 1 ошибка.');
  });

  const handle = async (ctx) => {
    const text = (ctx.text ?? '').trim();

    for (const [pattern, handler] of commands) {
      const match = text.match(pattern);
      if (match) {
        const args = match.slice(1);
        return handler(ctx, ...args);
      }
    }

    // Если не команда — можно ответить подсказкой
    await ctx.send('Не знаю такой команды. Напишите /help');
  };

  return { handle, register };
};