import type { JWT } from 'google-auth-library';

import {
  connectToSpreadsheet,
  fetchAllRows,
  getSheetByName,
} from '../../../infrastructure/google/sheets';
import { roomFromRow } from '../room';
import type { Room, RoomColumns } from '../room';

export type RoomsConfig = {
  spreadsheetId: string;
  rooms: {
    sheetName: string;
    columns: RoomColumns;
  };
};

export const getRooms = async (
  config: RoomsConfig,
  authClient: JWT,
): Promise<Room[]> => {
  const doc = await connectToSpreadsheet(config.spreadsheetId, authClient);
  const sheet = getSheetByName(doc, config.rooms.sheetName);
  const rows = await fetchAllRows(sheet);
  return rows
    .map((row) => roomFromRow(config.rooms.columns, (key) => row.get(key)))
    .filter((r): r is Room => r !== null);
};

export const listRoomNames = async (
  config: RoomsConfig,
  authClient: JWT,
): Promise<string[]> => {
  const rooms = await getRooms(config, authClient);
  return rooms.map((r) => r.name);
};