import type { DaySchedule } from './daySchedule';
import type { Lesson } from './lesson';

// ---------- Вход ----------

export type NewLessonInput = {
  date: string;
  time: string;
  roomName: string;
  type: string;
  students: string[];
  teachers: string[];
};

export type RosterEntry = {
  fullName: string;
  aliases: string[];
};

export type ValidationInput = {
  candidate: NewLessonInput;
  day: DaySchedule | undefined;
  slots: string[];
  rooms: { id: string; name: string }[];
  students: RosterEntry[];
  teachers: RosterEntry[];
  /** При редактировании — ID урока, который исключаем из проверок конфликтов. */
  excludeLessonId?: string;
};

// ---------- Результат ----------

export type ValidationIssue = {
  code:
    | 'outside_working_hours'
    | 'unknown_date'
    | 'unknown_room'
    | 'unknown_id'
    | 'room_busy'
    | 'unknown_person'
    | 'person_busy';
  message: string;
  who?: string;
  withLesson?: Lesson;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

// ---------- Утилиты ----------

export const normalizeName = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, ' ');

const nameKey = (s: string): string =>
  normalizeName(s).split(' ').filter(Boolean).sort().join(' ');

export const splitNames = (s: string): string[] =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && x !== '—');

const namesMatch = (a: string, b: string, aliases: string[] = []): boolean => {
  const target = nameKey(a);
  if (nameKey(b) === target) return true;
  return aliases.some((alias) => nameKey(alias) === target);
};

const findPersonLesson = (
  day: DaySchedule,
  name: string,
  role: 'student' | 'teacher',
  aliases: string[],
  time: string,
  excludeLessonId?: string,
): Lesson | undefined => {
  const field = role === 'student' ? 'students' : 'teachers';
  return day.lessons.find(
    (l) =>
      l.id !== excludeLessonId &&
      l.time === time &&
      splitNames(l[field]).some((n) => namesMatch(n, name, aliases)),
  );
};

// ---------- Валидаторы ----------

const checkTime = (time: string, slots: string[]): ValidationIssue | null =>
  slots.includes(time)
    ? null
    : {
        code: 'outside_working_hours',
        message: `Время ${time} вне рабочего диапазона (${slots[0]}–${slots[slots.length - 1]})`,
      };

const checkRoom = (
  roomName: string,
  day: DaySchedule,
  time: string,
  rooms: { id: string; name: string }[],
  excludeLessonId?: string,
): ValidationIssue | null => {
  const exists = rooms.some((r) => r.name === roomName);
  if (!exists) {
    return {
      code: 'unknown_room',
      message: `Класс "${roomName}" отсутствует в справочнике`,
    };
  }

  const availability = day.availabilityByRoom[roomName];
  if (availability?.busy.includes(time)) {
    const conflicting = day.lessons.find(
      (l) =>
        l.roomName === roomName &&
        l.time === time &&
        l.id !== excludeLessonId,
    );
    if (conflicting) {
      return {
        code: 'room_busy',
        message: `Класс "${roomName}" занят в ${time}`,
        withLesson: conflicting,
      };
    }
  }
  return null;
};

const checkPeople = (
  names: string[],
  role: 'student' | 'teacher',
  day: DaySchedule,
  time: string,
  roster: RosterEntry[],
  excludeLessonId?: string,
): ValidationIssue[] => {
  const label = role === 'student' ? 'Ученик' : 'Преподаватель';
  const issues: ValidationIssue[] = [];

  for (const raw of names) {
    const entry = roster.find((r) => namesMatch(r.fullName, raw, r.aliases));
    if (!entry) {
      issues.push({
        code: 'unknown_person',
        message: `${label} "${raw}" не найден в справочнике`,
        who: raw,
      });
      continue;
    }

    const conflict = findPersonLesson(
      day,
      entry.fullName,
      role,
      entry.aliases,
      time,
      excludeLessonId,
    );
    if (conflict) {
      issues.push({
        code: 'person_busy',
        message: `${entry.fullName} уже занят в ${time} (${conflict.type}, ${conflict.roomName})`,
        who: entry.fullName,
        withLesson: conflict,
      });
    }
  }
  return issues;
};

// ---------- Точка входа ----------

export const validateNewLesson = ({
  candidate,
  day,
  slots,
  rooms,
  students,
  teachers,
  excludeLessonId,
}: ValidationInput): ValidationResult => {
  if (!day) {
    return {
      ok: false,
      issues: [
        {
          code: 'unknown_date',
          message: `Дата ${candidate.date} не найдена в расписании`,
        },
      ],
    };
  }

  const issues: ValidationIssue[] = [];

  const t = checkTime(candidate.time, slots);
  if (t) issues.push(t);

  const r = checkRoom(candidate.roomName, day, candidate.time, rooms, excludeLessonId);
  if (r) issues.push(r);

  issues.push(
    ...checkPeople(candidate.students, 'student', day, candidate.time, students, excludeLessonId),
  );
  issues.push(
    ...checkPeople(candidate.teachers, 'teacher', day, candidate.time, teachers, excludeLessonId),
  );

  return issues.length ? { ok: false, issues } : { ok: true };
};