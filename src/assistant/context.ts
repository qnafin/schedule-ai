import type { Sender } from '../features/users/services/resolveByVkId';

export interface SenderContext {
  vkId: number;
  user: Sender | null;
  timeZone?: string;
}

const DEFAULT_TZ = 'Europe/Moscow';

const DAYS_RU = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
];

const pad2 = (n: number): string => String(n).padStart(2, '0');

const partsInTz = (date: Date, timeZone: string) => {
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
};

export const formatNowLine = (timeZone = DEFAULT_TZ, now = new Date()): string => {
  const p = partsInTz(now, timeZone);
  const day = Number(p.day);
  const month = Number(p.month);
  const year = p.year;
  const hour = p.hour === '24' ? '00' : p.hour;

  const utcForWeekday = new Date(Date.UTC(Number(year), month - 1, day));
  const weekday = DAYS_RU[utcForWeekday.getUTCDay()];

  return `${weekday}, ${pad2(day)}.${pad2(month)}.${year}, ${hour}:${p.minute} (${timeZone})`;
};

export const renderContextLine = (
  ctx: SenderContext | undefined,
  now = new Date(),
): string | null => {
  if (!ctx) return null;

  const nowLine = `[Сейчас: ${formatNowLine(ctx.timeZone ?? DEFAULT_TZ, now)}]`;

  if (ctx.user) {
    return [
      nowLine,
      `[Кто пишет: ${ctx.user.fullName} (${ctx.user.role}, id=${ctx.user.id}, vk_id=${ctx.vkId})]`,
    ].join('\n');
  }

  return [
    nowLine,
    `[Кто пишет: не найден в справочнике, vk_id=${ctx.vkId}]`,
  ].join('\n');
};