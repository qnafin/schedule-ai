import { splitNames } from '../../shared/text';
import { diffDays } from '../../shared/datetime';
import { buildUsersIndex, resolveUser } from '../users/usersIndex';
import type { User,  } from '../users/user';
import type { DaySchedule } from '../schedule/daySchedule';
import type { Lesson } from '../schedule/lesson';
import {pad2} from '../../shared/text'
import type {NotificationRole, NotificationsConfig, Unresolved, NotificationPlan, BuildNotificationsInput} from './types'
// ---------- Формат ----------

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
export const workHoursOf = (config: NotificationsConfig) => ({
      from: `${pad2(config.schedule.workStartHour)}:00`,
      to: `${pad2(config.schedule.workEndHour)}:00`,
    });
export const formatRelativeDay = (date: string, today: string): string => {
  if (date === today) return 'Сегодня';
  const diff = diffDays(today, date);
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';

  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MONTHS_RU[Number(m[2]) - 1]}` : date;
};

const joinWithAnd = (parts: string[]): string => {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} и ${parts[parts.length - 1]}`;
};

/** "Иванов Иван, —, Петров Пётр" → ["Иванов Иван", "Петров Пётр"] */
const names = (raw: unknown): string[] =>
  splitNames(raw).filter((n) => n && n !== '—');

const renderLesson = (l: Lesson, role: NotificationRole): string => {
  const base = `— ${l.time} — ${l.type || 'занятие'}`;
  const cls = l.roomName ? ` (${l.roomName})` : '';
  const others = names(role === 'teacher' ? l.students : l.teachers);
  const tail = others.length ? ` • ${joinWithAnd(others)}` : '';
  return `${base}${cls}${tail}`;
};

export const renderNotification = (
  role: NotificationRole,
  lessons: Lesson[],
  relativeDay: string,
  greeting: string,
): string =>
  `${greeting} ${relativeDay} у тебя:\n${lessons
    .map((l) => renderLesson(l, role))
    .join('\n')}`;

export const renderChatSummary = (
  days: DaySchedule[],
  today: string,
  workHours: { from: string; to: string },
): string => {
  const blocks = days.map((day) => {
    const title = `${formatRelativeDay(day.date, today)}, ${day.date}:`;

    // День пустой — конкретики по классам нет, пишем общий диапазон
    if (day.lessons.length === 0) {
      return `${title}\nвремя с ${workHours.from} до ${workHours.to} свободно, записывайтесь активнее`;
    }

    const lines = Object.entries(day.availabilityByRoom).map(
      ([roomName, { free }]) =>
        `— ${roomName}: ${free.length ? free.join(', ') : 'нет свободных слотов'}`,
    );
    return `${title}\n${lines.join('\n')}`;
  });

  return ['Свободные время для репетиций', '', ...blocks].join('\n');
};

// ---------- Сборка ----------

type Bucket = {
  person: User;
  role: NotificationRole;
  lessons: Lesson[];
};

/**
 * Разбирает уроки дня: находит упомянутых людей, группирует уроки по человеку.
 * Один человек в разных уроках → один bucket.
 * Если имя не нашлось в справочнике → unresolved.
 */
const groupByPerson = (
  lessons: Lesson[],
  studentIndex: Map<string, User>,
  teacherIndex: Map<string, User>,
): { buckets: Bucket[]; unresolved: Unresolved[] } => {
  const buckets = new Map<string, Bucket>();
  const unresolved: Unresolved[] = [];

  for (const lesson of lessons) {
    const lookups = [
      { role: 'student' as const, raw: lesson.students, index: studentIndex },
      { role: 'teacher' as const, raw: lesson.teachers, index: teacherIndex },
    ];

    for (const { role, raw, index } of lookups) {
      for (const name of names(raw)) {
        const person = resolveUser(index, name);
        if (!person) {
          unresolved.push({ lessonId: lesson.id, role, name, date: lesson.date });
          continue;
        }
        const key = `${role}:${person.id}`;
        const existing = buckets.get(key);
        if (existing) existing.lessons.push(lesson);
        else buckets.set(key, { person, role, lessons: [lesson] });
      }
    }
  }

  return { buckets: [...buckets.values()], unresolved };
};

export const buildNotifications = ({
  days,
  users,
  today,
  greeting,
}: BuildNotificationsInput): NotificationPlan => {
  const studentIdx = buildUsersIndex(users.students);
  const teacherIdx = buildUsersIndex(users.teachers);

  const notifications: Notification[] = [];
  const unresolved: Unresolved[] = [];

  for (const day of days) {
    const { buckets, unresolved: dayUnresolved } = groupByPerson(
      day.lessons,
      studentIdx.index,
      teacherIdx.index,
    );
    unresolved.push(...dayUnresolved);

    const relativeDay = formatRelativeDay(day.date, today);

    for (const { person, role, lessons } of buckets) {
      const sorted = [...lessons].sort((a, z) => a.time.localeCompare(z.time));

      notifications.push({
        date: day.date,
        relativeDay,
        personId: person.id,
        fullName: person.fullName,
        role,
        channel: person.channel,
        vk: person.vk,
        phone: person.phone,
        lessons: sorted,
        text: renderNotification(role, sorted, relativeDay, greeting),
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    today,
    notifications,
    unresolved,
  };
};