import type { JWT } from 'google-auth-library';

import type { Lesson } from '../lesson';
import type { ScheduleConfig } from './getSchedule';
import { findLessonRowById } from './findLessonRowById';

export type DeleteResult =
  | { ok: true; id: string; deleted: Lesson }
  | { ok: false; message: string };

export const deleteLesson = async (
  config: ScheduleConfig,
  authClient: JWT,
  id: string,
): Promise<DeleteResult> => {
  const found = await findLessonRowById(config, authClient, id);
  if (!found) {
    return { ok: false, message: `Урок ${id} не найден` };
  }

  await found.row.delete();

  return { ok: true, id, deleted: found.lesson };
};