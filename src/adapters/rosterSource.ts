// src/adapters/rosterSource.js
import { personFromRow } from '../domain/roster';

export const createRosterLoader = (doc, config) => async () => {
  const { students, teachers } = config.roster;

  const studentsSheet = doc.sheetsByTitle[students.sheetName];
  const teachersSheet = doc.sheetsByTitle[teachers.sheetName];

  if (!studentsSheet) throw new Error(`Лист "${students.sheetName}" не найден`);
  if (!teachersSheet) throw new Error(`Лист "${teachers.sheetName}" не найден`);

  const [studentRows, teacherRows] = await Promise.all([
    studentsSheet.getRows(),
    teachersSheet.getRows(),
  ]);

  return {
    students: studentRows.map((r) => personFromRow(students.columns, r)).filter(Boolean),
    teachers: teacherRows.map((r) => personFromRow(teachers.columns, r)).filter(Boolean),
  };
};