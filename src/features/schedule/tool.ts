import { z } from "zod";
import type { FastMCP } from "fastmcp";
import type { JWT } from "google-auth-library";

import { getSchedule, listScheduleDates } from "./services/getSchedule";
import { appendLesson } from "./services/appendLesson";
import type { ScheduleConfig } from "./services/getSchedule";
import { updateLesson } from "./services/updateLesson";
import { deleteLesson } from "./services/deleteLesson";

type Deps = {
  config: ScheduleConfig;
  authClient: JWT;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const registerScheduleTools = (
  server: FastMCP,
  { config, authClient }: Deps
) => {
  
  server.addTool({
    name: "get_schedule",
    description:
      "Расписание на указанные даты. Если даты не переданы — вернёт все доступные дни. " +
      "Даты в формате ISO YYYY-MM-DD. " +
      "Для каждого дня возвращает уроки и доступность по классам (помещениям) — " +
      "даже если уроков в этот день нет, все классы из справочника будут в ответе со всеми свободными слотами.",
    parameters: z.object({
      dates: z
        .array(z.string().regex(ISO_DATE, "Ожидается YYYY-MM-DD"))
        .optional()
        .describe("Список дат в формате YYYY-MM-DD. Необязательно."),
    }),
    execute: async ({ dates }) => {
      const days = await getSchedule(config, authClient, { dates });
      return JSON.stringify(days, null, 2);
    },
  });
  server.addTool({
    name: "append_lesson",
    description:
      'Создаёт новую запись в листе "Расписание". НЕ проверяет конфликты — ' +
      "агент обязан сам сначала вызвать get_schedule и убедиться, что класс свободен, " +
      "а ученики и преподаватели не заняты в это время. " +
      "ID генерируется автоматически. Даты в формате DD.MM.YYYY, время HH:MM.",
    parameters: z.object({
      date: z
        .string()
        .regex(/^\d{2}\.\d{2}\.\d{4}$/)
        .describe("Дата в формате DD.MM.YYYY"),
      time: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .describe("Время начала в формате HH:MM"),
      roomName: z.string().describe("Класс"),
      type: z
        .string()
        .describe('Тип занятия, например "репетиция" или "урок 1.2"'),
      students: z.array(z.string()).describe("ФИО учеников"),
      teachers: z
        .array(z.string())
        .default([])
        .describe("ФИО преподавателей (может быть пустой массив)"),
    }),
    execute: async (params) => {
      const result = await appendLesson(config, authClient, {
        date: params.date,
        time: params.time,
        roomName: params.roomName,
        type: params.type,
        students: params.students,
        teachers: params.teachers ?? [],
      });
      return JSON.stringify(result, null, 2);
    },
  });
  server.addTool({
    name: "update_lesson",
    description:
      "Изменяет существующий урок по ID. Заменяет ВСЕ поля — передавай полный набор, " +
      "как для append_lesson. Проверяет конфликты как при создании, исключая сам урок. " +
      "Если меняется только часть — сначала get_schedule, чтобы получить актуальные значения остальных полей.",
    parameters: z.object({
      id: z
        .string()
        .min(1)
        .describe("ID урока для редактирования, например ID-0005"),
      date: z
        .string()
        .regex(/^\d{2}\.\d{2}\.\d{4}$/)
        .describe("Новая дата DD.MM.YYYY"),
      time: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .describe("Новое время HH:MM"),
      roomName: z.string().min(1).describe("Класс/направление"),
      type: z.string().min(1).describe("Тип занятия"),
      students: z.array(z.string().min(1)).min(1).describe("ФИО учеников"),
      teachers: z
        .array(z.string().min(1))
        .default([])
        .describe("ФИО преподавателей"),
    }),
    execute: async (params) => {
      const result = await updateLesson(config, authClient, params.id, {
        date: params.date,
        time: params.time,
        roomName: params.roomName,
        type: params.type,
        students: params.students,
        teachers: params.teachers,
      });
      return JSON.stringify(result, null, 2);
    },
  });

  server.addTool({
    name: "delete_lesson",
    description:
      "Удаляет урок по ID. Операция необратима — строка удаляется из таблицы. " +
      "Перед вызовом покажи пользователю, что удаляешь (дата, время, класс, кто), и дождись подтверждения. " +
      "Если не знаешь ID — используй get_schedule, чтобы его найти.",
    parameters: z.object({
      id: z.string().min(1).describe("ID урока для удаления, например ID-0005"),
    }),
    execute: async ({ id }) => {
      const result = await deleteLesson(config, authClient, id);
      return JSON.stringify(result, null, 2);
    },
  });
};
