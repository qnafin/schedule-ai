import type { JWT } from 'google-auth-library';

import { getSchedule } from './getSchedule';
import type { ScheduleConfig } from './getSchedule';
import { getRooms } from '../../rooms/services/getRooms';
import { getUsers } from '../../users/services/getUsers';
import { buildSlots } from '../slots';
import { validateNewLesson } from '../validation';
import type { NewLessonInput, ValidationIssue } from '../validation';
import { findLessonRowById } from './findLessonRowById';

export type UpdateResult =
  | { ok: true; id: string; row: NewLessonInput }
  | { ok: false; issues: ValidationIssue[] };

export const updateLesson = async (
  config: ScheduleConfig,
  authClient: JWT,
  id: string,
  updates: NewLessonInput,
): Promise<UpdateResult> => {
  // 1. Урок должен существовать
  const found = await findLessonRowById(config, authClient, id);
  if (!found) {
    return {
      ok: false,
      issues: [{ code: 'unknown_id', message: `Урок ${id} не найден` }],
    };
  }

  // 2. Загружаем данные для валидации
  const [days, rooms, users] = await Promise.all([
    getSchedule(config, authClient, { dates: [updates.date] }),
    getRooms(config, authClient),
    getUsers(config, authClient),
  ]);

  // 3. Валидируем, исключая сам урок из конфликтов
  const validation = validateNewLesson({
    candidate: updates,
    day: days[0],
    slots: buildSlots(config.schedule),
    rooms,
    students: users.students.map((u) => ({ fullName: u.fullName, aliases: [] })),
    teachers: users.teachers.map((u) => ({ fullName: u.fullName, aliases: [] })),
    excludeLessonId: id,
  });

  if (!validation.ok) return validation;

  // 4. Обновляем строку
  const cols = config.schedule.columns;
  found.row.set(cols.date, updates.date);
  found.row.set(cols.time, updates.time);
  found.row.set(cols.roomName, updates.roomName);
  found.row.set(cols.type, updates.type);
  found.row.set(cols.students, updates.students.join(', '));
  found.row.set(cols.teachers, updates.teachers.join(', '));
  await found.row.save();

  return { ok: true, id, row: updates };
};