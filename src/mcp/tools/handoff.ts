import { z } from 'zod';
import type { FastMCP } from 'fastmcp';

export const registerHandoffTool = (server: FastMCP) => {
  server.addTool({
    name: 'handoff_to_router',
    description:
      'Вернуть управление оркестратору. Используй ТОЛЬКО если вопрос явно ' +
      'не по твоей теме и не может быть решён уточнением. ' +
      'НЕ используй для простых случаев и уточнений.',
    parameters: z.object({
      reason: z
        .string()
        .describe('Кратко: почему вопрос не по твоей теме'),
    }),
    execute: async ({ reason }) => {
      return JSON.stringify({ handoff: true, reason });
    },
  });
};