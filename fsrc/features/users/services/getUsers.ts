import type { GoogleSpreadsheet } from 'google-spreadsheet';
import type { JWT } from 'google-auth-library';

import {
  connectToSpreadsheet,
  getSheetByName,
  fetchAllRows,
} from '../../../infrastructure/google/sheets';
import { createCache } from '../../../shared/cache';
import { userFromRow } from '../user';
import type { User, UserColumns } from '../user';

export type UsersSheetConfig = {
  sheetName: string;
  columns: UserColumns;
};

export type UsersConfig = {
  spreadsheetId: string;
  users: {
    students: UsersSheetConfig;
    teachers: UsersSheetConfig;
  };
};

export type Users = {
  students: User[];
  teachers: User[];
};

const CACHE_TTL_MS = 5 * 60_000;
const cache = createCache<Users>(CACHE_TTL_MS);

export const invalidateUsersCache = (): void => cache.invalidate();

const loadSheet = async (
  doc: GoogleSpreadsheet,
  config: UsersSheetConfig,
): Promise<User[]> => {
  const sheet = getSheetByName(doc, config.sheetName);
  const rows = await fetchAllRows(sheet);

  return rows
    .map((row) => userFromRow(config.columns, (key) => row.get(key)))
    .filter((u): u is User => u !== null);
};

const loadUsers = async (
  config: UsersConfig,
  authClient: JWT,
): Promise<Users> => {
  const doc = await connectToSpreadsheet(config.spreadsheetId, authClient);

  const [students, teachers] = await Promise.all([
    loadSheet(doc, config.users.students),
    loadSheet(doc, config.users.teachers),
  ]);

  return { students, teachers };
};

export const getUsers = (
  config: UsersConfig,
  authClient: JWT,
): Promise<Users> => cache.getOrLoad(() => loadUsers(config, authClient));