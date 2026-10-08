import type { JWT } from 'google-auth-library';

import { createCache } from '../../../shared/cache';
import { buildUsersIndex, resolveUser } from '../usersIndex';
import { getUsers } from './getUsers';
import type { User } from '../user';
import type { UsersConfig } from './getUsers';

export type FoundUser = {
  student: User | null;
  teacher: User | null;
};

type UsersIndexMaps = {
  students: Map<string, User>;
  teachers: Map<string, User>;
};

const INDEX_TTL_MS = 5 * 60_000;
const indexCache = createCache<UsersIndexMaps>(INDEX_TTL_MS);

export const invalidateUsersIndex = (): void => indexCache.invalidate();

const loadIndex = async (
  config: UsersConfig,
  authClient: JWT,
): Promise<UsersIndexMaps> => {
  const { students, teachers } = await getUsers(config, authClient);
  return {
    students: buildUsersIndex(students).index,
    teachers: buildUsersIndex(teachers).index,
  };
};

const getUsersIndex = (config: UsersConfig, authClient: JWT) =>
  indexCache.getOrLoad(() => loadIndex(config, authClient));

/**
 * Найти пользователя по ФИО среди учеников и преподавателей.
 * Возвращает null, если не найден ни там, ни там.
 * Один и тот же человек может быть и учеником, и преподавателем — тогда оба поля заполнены.
 */
export const findStudent = async (
  config: UsersConfig,
  authClient: JWT,
  name: string,
): Promise<User | null> => {
  const { students } = await getUsersIndex(config, authClient);
  return resolveUser(students, name);
};

export const findTeacher = async (
  config: UsersConfig,
  authClient: JWT,
  name: string,
): Promise<User | null> => {
  const { teachers } = await getUsersIndex(config, authClient);
  return resolveUser(teachers, name);
};