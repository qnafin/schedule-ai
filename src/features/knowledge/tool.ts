import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import { searchKnowledge } from './index';

export const registerKnowledgeTool = (server: FastMCP) => {
  server.addTool({
    name: 'search_knowledge',
    description:
      'Поиск по базе знаний школы: правила, прайс-лист, устав, FAQ. ' +
      'ВСЕГДА используй этот инструмент для вопросов про цены, стоимость, ' +
      'абонементы, скидки, правила оплаты, переносы, оборудование, форматы. ' +
      'Можно вызывать несколько раз с разными формулировками, если первая ' +
      'попытка не дала результата. Возвращает текстовые фрагменты с источниками.',
    parameters: z.object({
      query: z
        .string()
        .describe(
          'Поисковый запрос. Формулируй конкретно: не «цены», а ' +
            '«стоимость абонемента на 8 занятий по 60 минут»',
        ),
    }),
    execute: async ({ query }) => {
      const hits = await searchKnowledge(query, 5);

      if (hits.length === 0) {
        return JSON.stringify({ found: false, hits: [] });
      }

      return JSON.stringify({
        found: true,
        hits: hits.map((h) => ({
          source: h.source,
          heading: h.heading,
          score: Number(h.score.toFixed(2)),
          text: h.text,
        })),
      });
    },
  });
};