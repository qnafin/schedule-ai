// src/domain/notifications.js
import { resolvePerson, splitNames } from './roster.js';

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const parseDdMmYyyy = (s) => {
  const m = String(s ?? '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
};

// "01.09.2026" при today="31.08.2026" → "Завтра"
export const formatRelativeDay = (date, today) => {
  if (date === today) return 'Сегодня';
  const a = parseDdMmYyyy(today);
  const b = parseDdMmYyyy(date);
  if (a && b) {
    const diff = Math.round(
      (Date.UTC(b.year, b.month - 1, b.day) -
        Date.UTC(a.year, a.month - 1, a.day)) / 86400000
    );
    if (diff === 1) return 'Завтра';
    if (diff === -1) return 'Вчера';
    return `${b.day} ${MONTHS_RU[b.month - 1]}`;
  }
  return date;
};

const joinWithAnd = (parts) => {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} и ${parts[parts.length - 1]}`;
};

const typeOf = (t) => t || 'занятие';
const cleanNames = (raw) => splitNames(raw).filter((n) => n && n !== '—');

// ---------- Группировка уроков по людям ----------
const bucketKey = (role, person) => `${role}:${person.id}`;

const collectBuckets = (day, studentIndex, teacherIndex) => {
  const buckets = new Map();
  const unresolved = [];

  for (const lesson of day.lessons) {
    const lookups = [
      { role: 'student', raw: lesson.students, index: studentIndex },
      { role: 'teacher', raw: lesson.teachers, index: teacherIndex },
    ];

    for (const { role, raw, index } of lookups) {
      for (const name of cleanNames(raw)) {
        const person = resolvePerson(index, name);
        if (!person) {
          unresolved.push({ name, role, lessonId: lesson.id });
          continue;
        }
        const key = bucketKey(role, person);
        if (!buckets.has(key)) buckets.set(key, { person, role, lessons: [] });
        buckets.get(key).lessons.push(lesson);
      }
    }
  }

  return { buckets: [...buckets.values()], unresolved };
};

// ---------- Рендер ----------
const renderStudentLesson = (l) => `${typeOf(l.type)} в ${l.time}`;

const renderTeacherLesson = (l) => {
  const students = joinWithAnd(cleanNames(l.students));
  const extras = [l.className, students].filter(Boolean).join(', ');
  return `${typeOf(l.type)} в ${l.time}${extras ? ` (${extras})` : ''}`;
};

const renderText = (greeting, relativeDay, lessons, renderLesson) =>
  `${greeting} ${relativeDay} у тебя ${joinWithAnd(lessons.map(renderLesson))}`;

const toNotification = (bucket, relativeDay, greeting) => {
  const { person, role, lessons } = bucket;
  const sorted = [...lessons].sort((a, z) => a.time.localeCompare(z.time));
  const renderLesson = role === 'teacher' ? renderTeacherLesson : renderStudentLesson;

  return {
    personId: person.id,
    fullName: person.fullName,
    channel: person.channel,
    vk: person.vk,
    phone: person.phone,
    lessons: sorted.map((l) => ({
      id: l.id,
      time: l.time,
      class: l.className,
      type: l.type,
      ...(role === 'teacher' ? { students: cleanNames(l.students) } : {}),
    })),
    text: renderText(greeting, relativeDay, sorted, renderLesson),
  };
};

// ---------- Точка входа для дня ----------
export const buildDayNotifications = (day, {
  studentIndex, teacherIndex, today, greeting,
}) => {
  const { buckets, unresolved } = collectBuckets(day, studentIndex, teacherIndex);
  const relativeDay = formatRelativeDay(day.date, today);

  const byRole = (role) =>
    buckets
      .filter((b) => b.role === role)
      .map((b) => toNotification(b, relativeDay, greeting));

  return {
    date: day.date,
    relativeDay,
    students: byRole('student'),
    teachers: byRole('teacher'),
    unresolved,
  };
};