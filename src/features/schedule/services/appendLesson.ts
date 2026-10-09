import { randomUUID } from 'node:crypto';
import type { JWT } from 'google-auth-library';

import {
  connectToSpreadsheet,
  getSheetByName,
  appendRow,
} from '../../../infrastructure/google/sheets';
import { getSchedule } from './getSchedule';
import type { ScheduleConfig } from './getSchedule';
import { getRooms } from '../../rooms/services/getRooms';
import { getUsers } from '../../users/services/getUsers';
import { buildSlots } from '../slots';
import { validateNewLesson } from '../validation';
import type { NewLessonInput, ValidationIssue } from '../validation';

export type AppendResult =
  | { ok: true; id: string; row: NewLessonInput }
  | { ok: false; issues: ValidationIssue[] };

export const appendLesson = async (
  config: ScheduleConfig,
  authClient: JWT,
  lesson: NewLessonInput,
): Promise<AppendResult> => {
  // 1. Загружаем актуальные данные
  const [days, rooms, users] = await Promise.all([
    getSchedule(config, authClient, { dates: [lesson.date] }),
    getRooms(config, authClient),
    getUsers(config, authClient),
  ]);

  // 2. Валидируем
  const validation = validateNewLesson({
    candidate: lesson,
    day: days[0],
    slots: buildSlots(config.schedule),
    rooms,
    students: users.students.map((u) => ({ fullName: u.fullName, aliases: [] })),
    teachers: users.teachers.map((u) => ({ fullName: u.fullName, aliases: [] })),
  });

  if (!validation.ok) return validation;

  // 3. Пишем
  const id = randomUUID();
  const doc = await connectToSpreadsheet(config.spreadsheetId, authClient);
  const sheet = getSheetByName(doc, config.schedule.sheetName);
  const cols = config.schedule.columns;

  await appendRow(sheet, {
    [cols.id]: id,
    [cols.date]: lesson.date,
    [cols.time]: lesson.time,
    [cols.roomName]: lesson.roomName,
    [cols.type]: lesson.type,
    [cols.students]: lesson.students.join(', '),
    [cols.teachers]: lesson.teachers.join(', '),
  });

  return { ok: true, id, row: lesson };
};