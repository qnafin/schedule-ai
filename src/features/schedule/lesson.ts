import { normalizeDate, normalizeTime } from '../../shared/datetime';
import {  text } from '../../shared/text';
import type { RowReader } from '../../shared/types';
export type Lesson = {
  id: string;
  date: string; // ISO YYYY-MM-DD
  time: string; // HH:MM
  roomName: string;
  type: string;
  students: string;
  teachers: string;
};

export type LessonColumns = {
  id: string;
  date: string;
  time: string;
  roomName: string;
  type: string;
  students: string;
  teachers: string;
};


export const lessonFromRow = (
  columns: LessonColumns,
  read: RowReader,
): Lesson => {
  const get = (key: string) => read(key);
  return {
    id: text(get(columns.id)),
    date: normalizeDate(get(columns.date)),
    time: normalizeTime(get(columns.time)),
    roomName: text(get(columns.roomName)),
    type: text(get(columns.type)),
    students: text(get(columns.students)),
    teachers: text(get(columns.teachers)),
  };
};

export const isLessonEmpty = (l: Lesson): boolean =>
  !l.id && !l.time && !l.roomName && !l.type && !l.students && !l.teachers;

export const isLessonBooked = (l: Lesson): boolean => Boolean(l.time);
