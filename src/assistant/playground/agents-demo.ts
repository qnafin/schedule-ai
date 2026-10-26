import {
  Agent,
  run,
  hostedMcpTool,
  MemorySession,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from '@openai/agents';
import OpenAI from 'openai';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { formatNowLine } from '../../assistant/shared/context';

setTracingDisabled(true);  // ← нет шума про OpenAI tracing

const apiKey = process.env.YANDEX_CLOUD_API_KEY;
const folderId = process.env.YANDEX_CLOUD_FOLDER_ID;
const mcpUrl = process.env.MCP_URL_SSE;
if (!apiKey || !folderId || !mcpUrl) {
  throw new Error('YANDEX_CLOUD_API_KEY / FOLDER_ID / MCP_URL_SSE не заданы');
}

setDefaultOpenAIClient(
  new OpenAI({
    apiKey,
    baseURL: 'https://ai.api.cloud.yandex.net/v1',
    defaultHeaders: { 'OpenAI-Project': folderId },
  }),
);
setOpenAIAPI('responses');

const model = (m: string) => `gpt://${folderId}/${m}/latest`;

const mcpTool = hostedMcpTool({
  serverLabel: 'schedule',
  serverUrl: mcpUrl,
  requireApproval: 'never',
});

console.log('[mcp] hosted tool →', mcpUrl);

// ============================================================
// Агенты — с усиленным форматом
// ============================================================

const FORMAT_RULE = `
ФОРМАТ ОТВЕТА (СТРОГО):
- Без маркдауна. НЕ используй **, *, #, - и другие символы разметки.
- Только обычный текст. Список — через "•" и перенос строки.
- Одна-две фразы, только суть.
- Один 🥁 в конце.
- На "ты".
`.trim();

const scheduleAgent = new Agent({
  name: 'ScheduleAgent',
  model: model('deepseek-v4-flash'),
  instructions: `
Ты — ассистент школы музыки. Помогаешь с расписанием и записью.

${FORMAT_RULE}

Строка [Сейчас: ...] в начале — текущее время школы.
"Сегодня", "завтра" — считай от неё.

Для цен и правил → передай KnowledgeAgent.
  `.trim(),
  tools: [mcpTool],
  modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
});

const knowledgeAgent = new Agent({
  name: 'KnowledgeAgent',
  model: model('deepseek-v4-flash'),
  instructions: `
Ты — ассистент школы. Отвечаешь про цены, правила, оплату, форматы.

${FORMAT_RULE}

Для записи → передай ScheduleAgent.
  `.trim(),
  tools: [mcpTool],
  modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
});

const triageAgent = new Agent({
  name: 'TriageAgent',
  model: model('yandexgpt-lite'),
  instructions: `
Ты — роутер школы барабанов. НЕ отвечай сам.
Вызови transfer_to_schedule или transfer_to_knowledge.

ЖЁСТКОЕ ПРАВИЛО: ты НИКОГДА не отвечаешь пользователю сам.
Твой единственный ответ — вызов одного из тулов:
- transfer_to_schedule
- transfer_to_knowledge

- Расписание, запись, перенос → transfer_to_schedule
- Цены, правила, оплата → transfer_to_knowledge
  `.trim(),
  handoffs: [scheduleAgent, knowledgeAgent],
  modelSettings: { temperature: 0, reasoning: { effort: 'low' } },
});

scheduleAgent.handoffs = [knowledgeAgent];
knowledgeAgent.handoffs = [scheduleAgent];

// ============================================================
// Запуск
// ============================================================

const session = new MemorySession();
const rl = readline.createInterface({ input: stdin, output: stdout });

console.log('\n🤖 Демо @openai/agents. /reset — сброс, /exit — выход.\n');

while (true) {
  const userInput = (await rl.question('Вы: ')).trim();
  if (!userInput) continue;
  if (userInput === '/exit') break;
  if (userInput === '/reset') {
    session.clearSession();
    console.log('🧹 История сброшена\n');
    continue;
  }

  // ← Контекст с датой
  const now = formatNowLine('Europe/Moscow');
  const input = `[Сейчас: ${now}]\n\n${userInput}`;

  try {
    const result = await run(triageAgent, input, {
      session,
      maxTurns: 10,
    });
    console.log(`[${result.lastAgent?.name ?? '?'}]: ${result.finalOutput}\n`);
    
  } catch (err) {
    console.error('Ошибка:', (err as Error).message);
  }
}

rl.close();