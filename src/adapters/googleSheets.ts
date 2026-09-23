import { GoogleSpreadsheet } from 'google-spreadsheet';

export const connectToSheet = async (config, authClient) => {
  const doc = new GoogleSpreadsheet(config.spreadsheetId, authClient);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[config.schedule.sheetName];
  if (!sheet) throw new Error(`Лист "${config.schedule.sheetName}" не найден`);

  return { doc, sheet };
};

/** Возвращает функцию, реализующую порт `fetchAllRows` */
export const createRowsFetcher = (sheet) => () => sheet.getRows();