// fsrc/infrastructure/google/sheets.ts
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import type { JWT } from 'google-auth-library';

export const connectToSpreadsheet = async (
  spreadsheetId: string,
  authClient: JWT,
): Promise<GoogleSpreadsheet> => {
  const doc = new GoogleSpreadsheet(spreadsheetId, authClient);
  await doc.loadInfo();
  return doc;
};

export const getSheetByName = (
  doc: GoogleSpreadsheet,
  sheetName: string,
): GoogleSpreadsheetWorksheet => {
  const sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) {
    throw new Error(`Лист "${sheetName}" не найден`);
  }
  return sheet;
};

export const fetchAllRows = (sheet: GoogleSpreadsheetWorksheet) =>
  sheet.getRows();