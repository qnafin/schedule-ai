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
    rooms: number;
  };
  lessons: Lesson[];
  availabilityByRoom: Record<string, Availability>;
};

// ---------- Helpers (экспорт для тестов) ----------

export const roomNamesOf = (lessons: Lesson[]): string[] => [
  ...new Set(lessons.map((l) => l.roomName).filter(Boolean)),
];

 const busySlotsOf = (lessons: Lesson[]): Set<string> =>
  new Set(lessons.filter(isLessonBooked).map((l) => l.time));

const busySlotsForClass = (lessons: Lesson[], roomName: string): Set<string> =>
  new Set(
    lessons
      .filter((l) => isLessonBooked(l) && l.roomName === roomName)
      .map((l) => l.time),
  );

const makeAvailabilityByRoom = (
  slots: string[],
  lessons: Lesson[],
): Record<string, Availability> =>
  Object.fromEntries(
    roomNamesOf(lessons).map((roomName) => {
      const busy = busySlotsForClass(lessons, roomName);
      return [
        roomName,
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
      rooms: roomNamesOf(lessons).length,
    },
    lessons: booked,
    availabilityByRoom: makeAvailabilityByRoom(slots, lessons),
  };
};