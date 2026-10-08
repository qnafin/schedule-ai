import type { GoogleSpreadsheet } from 'google-spreadsheet';
import type { JWT } from 'google-auth-library';

import {
  connectToSpreadsheet,
  fetchAllRows,
  getSheetByName,
} from '../../../infrastructure/google/sheets';
import { createCache } from '../../../shared/cache';
import { roomFromRow } from '../room';
import type { Room, RoomColumns } from '../room';

export type RoomsConfig = {
  spreadsheetId: string;
  rooms: {
    sheetName: string;
    columns: RoomColumns;
  };
};

const CACHE_TTL_MS = 5 * 60_000;
const cache = createCache<Room[]>(CACHE_TTL_MS);

export const invalidateRoomsCache = (): void => cache.invalidate();

const loadRooms = async (
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

export const getRooms = (
  config: RoomsConfig,
  authClient: JWT,
): Promise<Room[]> => cache.getOrLoad(() => loadRooms(config, authClient));

export const listRoomNames = async (
  config: RoomsConfig,
  authClient: JWT,
): Promise<string[]> => {
  const rooms = await getRooms(config, authClient);
  return rooms.map((r) => r.name);
};