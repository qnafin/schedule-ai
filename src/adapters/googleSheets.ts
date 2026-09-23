import { GoogleSpreadsheet } from 'google-spreadsheet';

export const connectToSheet = async (config, authClient) => {
  const doc = new GoogleSpreadsheet(config.spreadsheetId, authClient);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[config.sheetName];
  if (!sheet) throw new Error(`Лист "${config.sheetName}" не найден`);
  return sheet;
};

/** Возвращает функцию, реализующую порт `fetchAllRows` */
export const createRowsFetcher = (sheet) => () => sheet.getRows();