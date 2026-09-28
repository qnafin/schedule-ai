import type { User } from './user';
import { nameKey } from './user';

export type UsersIndex = {
  index: Map<string, User>;
  conflicts: Array<{ key: string; a: string; b: string }>;
};

export const buildUsersIndex = (users: User[]): UsersIndex => {
  const index = new Map<string, User>();
  const conflicts: UsersIndex['conflicts'] = [];

  for (const u of users) {
    const key = nameKey(u.fullName);
    const existing = index.get(key);
    if (existing && existing.id !== u.id) {
      conflicts.push({ key, a: existing.fullName, b: u.fullName });
      continue;
    }
    if (!existing) index.set(key, u);
  }

  return { index, conflicts };
};

export const resolveUser = (
  index: Map<string, User>,
  name: string,
): User | null => (name ? index.get(nameKey(name)) ?? null : null);