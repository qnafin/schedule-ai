import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import type { JWT } from 'google-auth-library';

import { getUsers, invalidateUsersCache } from './services/getUsers';
import {
  findStudent,
  findTeacher,
  invalidateUsersIndex,
} from './services/findUser';
import type { UsersConfig } from './services/getUsers';
import type { User } from './user';

type Deps = {
  config: UsersConfig;
  authClient: JWT;
};

const toContact = (u: User) => ({
  id: u.id,
  fullName: u.fullName,
  channel: u.channel,
  phone: u.phone || null,
  vk: u.vk,
});

const invalidateAll = (): void => {
  invalidateUsersCache();
  invalidateUsersIndex();
};

export const registerUserTools = (
  server: FastMCP,
  { config, authClient }: Deps,
) => {
  server.addTool({
    name: 'list_students',
    description: 'Список учеников школы (ФИО и контакт для уведомлений).',
    parameters: z.object({}),
    execute: async () => {
      const { students } = await getUsers(config, authClient);
      return JSON.stringify(students.map(toContact), null, 2);
    },
  });

  server.addTool({
    name: 'list_teachers',
    description: 'Список преподавателей школы (ФИО и контакт для уведомлений).',
    parameters: z.object({}),
    execute: async () => {
      const { teachers } = await getUsers(config, authClient);
      return JSON.stringify(teachers.map(toContact), null, 2);
    },
  });

  server.addTool({
    name: 'find_student',
    description: 'Найти ученика по ФИО. Регистр и порядок слов не важны.',
    parameters: z.object({
      name: z
        .string()
        .describe('ФИО, например «Кунафин Руслан» или «Руслан Кунафин»'),
    }),
    execute: async ({ name }) => {
      const student = await findStudent(config, authClient, name);
      if (!student) throw new Error(`Ученик "${name}" не найден`);
      return JSON.stringify(toContact(student), null, 2);
    },
  });

  server.addTool({
    name: 'find_teacher',
    description: 'Найти преподавателя по ФИО. Регистр и порядок слов не важны.',
    parameters: z.object({
      name: z
        .string()
        .describe('ФИО, например «Савинов Анатолий» или «Анатолий Савинов»'),
    }),
    execute: async ({ name }) => {
      const teacher = await findTeacher(config, authClient, name);
      if (!teacher) throw new Error(`Преподаватель "${name}" не найден`);
      return JSON.stringify(toContact(teacher), null, 2);
    },
  });

  server.addTool({
    name: 'refresh_users',
    description:
      'Сбросить кэш пользователей и перечитать данные из Google Sheets. ' +
      'Используй, если в таблице только что поменяли данные.',
    parameters: z.object({}),
    execute: async () => {
      invalidateAll();
      const { students, teachers } = await getUsers(config, authClient);

      return JSON.stringify({
        refreshed: true,
        students: students.length,
        teachers: teachers.length,
      });
    },
  });
};