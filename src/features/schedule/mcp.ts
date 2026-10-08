import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import type { JWT } from 'google-auth-library';

import { getSchedule, listScheduleDates } from './services/getSchedule';
import type { ScheduleConfig } from './services/getSchedule';

type Deps = {
  config: ScheduleConfig;
  authClient: JWT;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const registerScheduleTools = (
  server: FastMCP,
  { config, authClient }: Deps,
) => {
  server.addTool({
    name: 'list_schedule_dates',
    description: 'Список доступных дат в расписании (ISO YYYY-MM-DD).',
    parameters: z.object({}),
    execute: async () => {
      const dates = await listScheduleDates(config, authClient);
      return JSON.stringify(dates, null, 2);
    },
  });

  server.addTool({
    name: 'get_schedule',
    description:
      'Расписание на указанные даты. Если даты не переданы — вернёт все доступные дни. ' +
      'Даты в формате ISO YYYY-MM-DD.',
    parameters: z.object({
      dates: z
        .array(z.string().regex(ISO_DATE, 'Ожидается YYYY-MM-DD'))
        .optional()
        .describe('Список дат в формате YYYY-MM-DD. Необязательно.'),
    }),
    execute: async ({ dates }) => {
      const days = await getSchedule(config, authClient, { dates });
      return JSON.stringify(days, null, 2);
    },
  });
};