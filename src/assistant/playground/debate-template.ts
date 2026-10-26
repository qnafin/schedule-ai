// debate-template.ts
import {
  Agent, run,
  setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled,
} from '@openai/agents';
import OpenAI from 'openai';
import { z } from 'zod';

setTracingDisabled(true);

const apiKey   = process.env.YANDEX_CLOUD_API_KEY!;
const folderId = process.env.YANDEX_CLOUD_FOLDER_ID!;
setDefaultOpenAIClient(new OpenAI({
  apiKey,
  baseURL: 'https://ai.api.cloud.yandex.net/v1',
  defaultHeaders: { 'OpenAI-Project': folderId },
}));
setOpenAIAPI('responses');
const model = (m: string) => `gpt://${folderId}/${m}/latest`;

// ============================================================
// CONFIG — единственное место, которое меняешь под новую тему
// ============================================================

interface DebaterConfig {
  name: string;         // отображается в логах
  school: string;       // ключ для Judge (snake_case)
  instructions: string; // промпт: позиция, аргументы, стиль, слабости
}

const CONFIG = {
  topic: `Тема дебатов: <вставь вопрос, на который нет однозначного ответа>.`,

  rounds: 2, // 1 = только заявления, 2 = заявления + 1 опровержение, 3 = +2-е опровержение

  debaters: [
    {
      name: 'Position A',
      school: 'position_a',
      instructions: `
Ты — сторонник позиции A (<название школы/традиции>).
Ключевые аргументы:
- <аргумент 1>
- <аргумент 2>
- <аргумент 3>
Слабости, которые ты знаешь: <возражение> — отвечай: <ответ>.
      `,
    },
    {
      name: 'Position B',
      school: 'position_b',
      instructions: `
Ты — сторонник позиции B (<название школы/традиции>).
Ключевые аргументы:
- <аргумент 1>
- <аргумент 2>
Слабости, которые ты знаешь: <возражение> — отвечай: <ответ>.
      `,
    },
    // добавь ещё — массив, длина не ограничена
  ] as DebaterConfig[],

  judgeInstructions: `
Ты — арбитр. Не выбирай "победителя" — разбери типы утверждений.
Классифицируй каждое существенное утверждение:
- empirical — проверяемое (документы, действия, статистика)
- normative — оценочное
- mixed — эмпирика + оценка
- unfalsifiable — нельзя проверить

Не путай "объяснение" с "оправданием".
В conclusion: что каждая школа проясняет, а что затемняет.
  `.trim(),
};

// ============================================================
// Схемы — генерируются из CONFIG
// ============================================================

const DebateOutput = z.object({
  thinking: z.string().describe('стратегия, что хочу доказать'),
  argument: z.string().describe('реплика вслух, 4–7 предложений'),
});

const schoolEnum = z.enum(
  CONFIG.debaters.map((d) => d.school) as [string, ...string[]],
);

const JudgeOutput = z.object({
  thinking: z.string(),
  claimVerdicts: z.array(z.object({
    school: schoolEnum,
    claim: z.string(),
    verdict: z.enum(['empirical', 'normative', 'mixed', 'unfalsifiable']),
    reason: z.string(),
  })),
  conclusion: z.string(),
});

// ============================================================
// Агенты — собираются из CONFIG
// ============================================================

const debaters = CONFIG.debaters.map((d) => ({
  name: d.name,
  agent: new Agent({
    name: d.name,
    model: model('deepseek-v4-flash'),
    instructions: d.instructions.trim(),
    outputType: DebateOutput,
    modelSettings: { temperature: 0.3, reasoning: { effort: 'low' } },
  }),
}));

const judgeAgent = new Agent({
  name: 'Judge',
  model: model('deepseek-v4-flash'),
  instructions: `
${CONFIG.judgeInstructions}

Школы в дебатах: ${CONFIG.debaters.map((d) => d.school).join(', ')}.
  `.trim(),
  outputType: JudgeOutput,
  modelSettings: { temperature: 0.1, reasoning: { effort: 'low' } },
});

// ============================================================
// ORCHESTRATOR
// ============================================================

const indent  = (s: string) => s.split('\n').map((l) => '  ' + l).join('\n');
const divider = (t: string) => `\n${'═'.repeat(72)}\n${t}\n${'═'.repeat(72)}\n`;

async function speak(agent: Agent, input: string, label: string): Promise<string> {
  const res = await run(agent, input);
  const out = res.finalOutput;
  if (!out) throw new Error(`[${label}] пустой ответ — проверь outputType`);
  console.log(`\n→ ${label} думает:`);
  console.log(indent(out.thinking));
  console.log(`\n← ${label} говорит:`);
  console.log(indent(out.argument));
  return out.argument;
}

async function main() {
  console.log(divider('📋 ТЕМА'));
  console.log(indent(CONFIG.topic));

  let transcript = '';

  // === ДИНАМИЧЕСКИЕ РАУНДЫ ===
  for (let r = 1; r <= CONFIG.rounds; r++) {
    const isOpening = r === 1;
    const label = isOpening
      ? 'РАУНД 1: ОТКРЫВАЮЩИЕ ЗАЯВЛЕНИЯ'
      : `РАУНД ${r}: ОПРОВЕРЖЕНИЯ`;
    console.log(divider(`🗣️  ${label}`));

    const entries: string[] = [];

    for (const d of debaters) {
      const input = isOpening
        ? `# Тема:\n${CONFIG.topic}\n\nРаунд 1: сделай открывающее заявление.`
        : `# Тема:\n${CONFIG.topic}\n\n# Стенограмма до этого раунда:\n${transcript}\n\nРаунд ${r}: ответь на аргументы других школ. Атакуй слабые места.`;

      const arg = await speak(d.agent, input, d.name);
      entries.push(`## ${d.name}:\n${arg}`);
    }

    transcript += `\n\n# Раунд ${r}\n${entries.join('\n\n')}`;
  }

  // === АРБИТР ===
  console.log(divider('⚖️  АРБИТР'));

  const judgeRes = await run(
    judgeAgent,
    `# Тема:\n${CONFIG.topic}\n\n# Стенограмма:\n${transcript}\n\nВзвесь и вынеси вердикты.`,
  );
  const v = judgeRes.finalOutput;
  if (!v) throw new Error('[judge] пустой ответ');

  console.log('\n→ JUDGE думает:');
  console.log(indent(v.thinking));

  console.log('\n← ВЕРДИКТЫ:\n');
  const icons = {
    empirical: '📊', normative: '⚖️', mixed: '🔀', unfalsifiable: '❓',
  } as const;

  for (const cv of v.claimVerdicts) {
    console.log(`${icons[cv.verdict]} [${cv.school.toUpperCase()} / ${cv.verdict}]`);
    console.log(`  "${cv.claim}"`);
    console.log(indent(cv.reason) + '\n');
  }

  console.log(divider('📜 ВЫВОД АРБИТРА'));
  console.log(indent(v.conclusion));
}

main().catch((e) => { console.error(e); process.exit(1); });