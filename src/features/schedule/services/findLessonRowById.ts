import type { JWT } from 'google-auth-library';
import type { GoogleSpreadsheetRow } from 'google-spreadsheet';

import {
  connectToSpreadsheet,
  getSheetByName,
} from '../../../infrastructure/google/sheets';
import { lessonFromRow } from '../lesson';
import type { Lesson } from '../lesson';
import type { ScheduleConfig } from './getSchedule';

export type FoundLesson = {
  row: GoogleSpreadsheetRow;
  lesson: Lesson;
};

export const findLessonRowById = async (
  config: ScheduleConfig,
  authClient: JWT,
  id: string,
): Promise<FoundLesson | null> => {
  const doc = await connectToSpreadsheet(config.spreadsheetId, authClient);
  const sheet = getSheetByName(doc, config.schedule.sheetName);
  const cols = config.schedule.columns;
  const rows = await sheet.getRows();

  for (const row of rows) {
    const rowId = String(row.get(cols.id) ?? '').trim();
    if (rowId !== id) continue;
    return {
      row,
      lesson: lessonFromRow(cols, (key) => row.get(key)),
    };
  }
  return null;
};