import { isLessonBooked } from './lesson';
import type { Lesson } from './lesson';

export type Availability = {
  busy: string[];
  free: string[];
};

export type DaySchedule = {
  date: string;
  totals: {
    lessons: number;
    busySlots: number;
    classes: number;
  };
  lessons: Lesson[];
  availabilityByClass: Record<string, Availability>;
};

// ---------- Helpers (экспорт для тестов) ----------

export const classNamesOf = (lessons: Lesson[]): string[] => [
  ...new Set(lessons.map((l) => l.className).filter(Boolean)),
];

 const busySlotsOf = (lessons: Lesson[]): Set<string> =>
  new Set(lessons.filter(isLessonBooked).map((l) => l.time));

const busySlotsForClass = (lessons: Lesson[], className: string): Set<string> =>
  new Set(
    lessons
      .filter((l) => isLessonBooked(l) && l.className === className)
      .map((l) => l.time),
  );

const makeAvailabilityByClass = (
  slots: string[],
  lessons: Lesson[],
): Record<string, Availability> =>
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
    }),
  );

// ---------- Основная функция ----------

export const buildDaySchedule = (
  date: string,
  lessons: Lesson[],
  slots: string[],
): DaySchedule => {
  const booked = lessons.filter(isLessonBooked);

  return {
    date,
    totals: {
      lessons: booked.length,
      busySlots: busySlotsOf(lessons).size,
      classes: classNamesOf(lessons).length,
    },
    lessons: booked,
    availabilityByClass: makeAvailabilityByClass(slots, lessons),
  };
};