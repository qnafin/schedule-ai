import { isLessonBooked, lessonToJSON } from './lesson.js';

export const groupByTime = (lessons) =>
  lessons.reduce((acc, l) => {
    if (!l.time) return acc;
    (acc[l.time] ??= []).push(l);
    return acc;
  }, {});

export const busySlotsOf = (lessons) =>
  new Set(lessons.filter(isLessonBooked).map((l) => l.time));

export const classNamesOf = (lessons) =>
  [...new Set(lessons.map((l) => l.className).filter(Boolean))];

export const busySlotsForClass = (lessons, className) =>
  new Set(
    lessons
      .filter((l) => isLessonBooked(l) && l.className === className)
      .map((l) => l.time)
  );

export const makeBusyTime = (slots, lessons) => {
  const byTime = groupByTime(lessons);
  const busy = busySlotsOf(lessons);
  return slots
    .filter((t) => busy.has(t))
    .map((time) => ({
      time,
      lessons: (byTime[time] ?? []).map(lessonToJSON),
    }));
};

export const makeAvailabilityByClass = (slots, lessons) =>
  Object.fromEntries(
    classNamesOf(lessons).map((className) => {
      const busy = busySlotsForClass(lessons, className);
      return [
        className,
        {
          busy: slots.filter((t) => busy.has(t)),
          free: slots.filter((t) => !busy.has(t)),
        },
      ];
    })
  );

export const buildDaySchedule = (slots) => (date) => (lessonsOfDay) => ({
  date,
  totals: {
    lessons: lessonsOfDay.filter(isLessonBooked).length,
    busySlots: busySlotsOf(lessonsOfDay).size,
    classes: classNamesOf(lessonsOfDay).length,
  },
  lessons: lessonsOfDay.filter(isLessonBooked).map(lessonToJSON),
  availabilityByClass: makeAvailabilityByClass(slots, lessonsOfDay),
});