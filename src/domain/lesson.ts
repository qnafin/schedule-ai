import { text, normalizeDate, normalizeTime } from './normalizers.js';

export const lessonFromRow = (columns) => (row) => {
  const read = (key) => row.get(columns[key]);
  return {
    id: text(read('id')),
    date: normalizeDate(read('date')),
    time: normalizeTime(read('time')),
    className: text(read('className')),
    type: text(read('type')),
    students: text(read('students')),
    teachers: text(read('teachers')),
  };
};

export const isLessonEmpty = (l) =>
  !l.id && !l.time && !l.className && !l.type && !l.students && !l.teachers;

export const isLessonBooked = (l) => Boolean(l.time);

export const lessonToJSON = (l) => ({
  id: l.id,
  date: l.date,
  time: l.time,
  className: l.className,
  type: l.type,
  students: l.students,
  teachers: l.teachers,
});