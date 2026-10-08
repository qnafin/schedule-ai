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

// ---------- Helpers ----------

export const roomNamesOf = (lessons: Lesson[]): string[] => [
  ...new Set(lessons.map((l) => l.roomName).filter(Boolean)),
];

const mergeRoomNames = (base: string[], extra: string[]): string[] => [
  ...new Set([...base, ...extra]),
];

const busySlotsOf = (lessons: Lesson[]): Set<string> =>
  new Set(lessons.filter(isLessonBooked).map((l) => l.time));

const busySlotsForRoom = (lessons: Lesson[], roomName: string): Set<string> =>
  new Set(
    lessons
      .filter((l) => isLessonBooked(l) && l.roomName === roomName)
      .map((l) => l.time),
  );

const makeAvailabilityByRoom = (
  slots: string[],
  lessons: Lesson[],
  roomNames: string[],
): Record<string, Availability> =>
  Object.fromEntries(
    roomNames.map((roomName) => {
      const busy = busySlotsForRoom(lessons, roomName);
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
  allRoomNames: string[] = [],
): DaySchedule => {
  const booked = lessons.filter(isLessonBooked);
  const roomNames = mergeRoomNames(allRoomNames, roomNamesOf(lessons));

  return {
    date,
    totals: {
      lessons: booked.length,
      busySlots: busySlotsOf(lessons).size,
      rooms: roomNames.length,
    },
    lessons: booked,
    availabilityByRoom: makeAvailabilityByRoom(slots, lessons, roomNames),
  };
};