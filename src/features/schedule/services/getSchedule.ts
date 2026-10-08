import type { JWT } from 'google-auth-library';

import {
  connectToSpreadsheet,
  fetchAllRows,
  getSheetByName,
} from '../../../infrastructure/google/sheets';
import { buildDaySchedule } from '../daySchedule';
import type { DaySchedule } from '../daySchedule';
import { isLessonEmpty, lessonFromRow } from '../lesson';
import type { Lesson, LessonColumns } from '../lesson';
import { buildSlots } from '../slots';
import { listRoomNames } from '../../rooms/services/getRooms';
import type { RoomsConfig } from '../../rooms/services/getRooms';

export type ScheduleConfig = RoomsConfig & {
  schedule: {
    sheetName: string;
    columns: LessonColumns;
    workStartHour: number;
    workEndHour: number;
    slotMinutes: number;
  };
};

export const getLessons = async (
  config: ScheduleConfig,
  authClient: JWT,
): Promise<Lesson[]> => {
  const doc = await connectToSpreadsheet(config.spreadsheetId, authClient);
  const sheet = getSheetByName(doc, config.schedule.sheetName);
  const rows = await fetchAllRows(sheet);

  return rows
    .map((row) => lessonFromRow(config.schedule.columns, (key) => row.get(key)))
    .filter((l) => !isLessonEmpty(l));
};

export type GetScheduleOptions = {
  dates?: string[];
};

export const listScheduleDates = async (
  config: ScheduleConfig,
  authClient: JWT,
): Promise<string[]> => {
  const lessons = await getLessons(config, authClient);
  return [...new Set(lessons.map((l) => l.date).filter(Boolean))].sort();
};

export const getSchedule = async (
  config: ScheduleConfig,
  authClient: JWT,
  options: GetScheduleOptions = {},
): Promise<DaySchedule[]> => {
  const [lessons, allRoomNames] = await Promise.all([
    getLessons(config, authClient),
    listRoomNames(config, authClient),
  ]);

  const slots = buildSlots(config.schedule);

  const dates =
    options.dates && options.dates.length > 0
      ? options.dates
      : [...new Set(lessons.map((l) => l.date).filter(Boolean))].sort();

  const byDate = new Map<string, Lesson[]>();
  for (const l of lessons) {
    if (!l.date) continue;
    const bucket = byDate.get(l.date);
    if (bucket) bucket.push(l);
    else byDate.set(l.date, [l]);
  }

  return dates.map((date) =>
    buildDaySchedule(date, byDate.get(date) ?? [], slots, allRoomNames),
  );
};