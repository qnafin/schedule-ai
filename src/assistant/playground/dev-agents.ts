// dev-agents.ts
import {
  Agent,
  run,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from '@openai/agents';
import OpenAI from 'openai';
import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

setTracingDisabled(true);

const apiKey   = process.env.YANDEX_CLOUD_API_KEY!;
const folderId = process.env.YANDEX_CLOUD_FOLDER_ID!;
if (!apiKey || !folderId) throw new Error('env не заданы');

setDefaultOpenAIClient(
  new OpenAI({
    apiKey,
    baseURL: 'https://ai.api.cloud.yandex.net/v1',
    defaultHeaders: { 'OpenAI-Project': folderId },
  }),
);
setOpenAIAPI('responses');

const model = (m: string) => `gpt://${folderId}/${m}/latest`;
const MAX_ITER = 3;           // итераций dev↔review на один модуль
const MAX_STAGES = 20;        // защита от бесконечного плана

// ============================================================
// 1. PLANNER — разбивает ТЗ на модули
// ============================================================

const plannerAgent = new Agent({
  name: 'ArchitectPlanner',
  model: model('deepseek-v4-flash'),
  instructions: `
Ты senior-архитектор. На вход — ТЗ на Node.js + Express + SQLite REST API.
Разбей на модули/этапы. Для каждого этапа:
- id: короткий snake_case ("db_init", "routes_notes", "tests_notes")
- title: человекочитаемое
- files: пути (src/..., test/...)
- criteria: конкретные, проверяемые (3–6 штук)
- dependsOn: id этапов

Правила:
- Порядок: db → валидация → роуты → сервер → тесты
- Каждый этап ≤ 4 файлов
- Критерии — "POST /notes возвращает 201 с полем id", не "код хороший"
- Не включай package.json, .env, .gitignore, README — они уже есть
- ES modules (import/export), НЕ CommonJS require
- better-sqlite3 синхронный — не планируй async/await для БД
  `.trim(),
  outputType: z.object({
    stages: z.array(z.object({
      id: z.string(),
      title: z.string(),
      files: z.array(z.string()),
      criteria: z.array(z.string()),
      dependsOn: z.array(z.string()),
    })),
  }),
  modelSettings: { temperature: 0.2, reasoning: { effort: 'low' } },
});

// ============================================================
// 2. DEVELOPER — пишет/правит код по заданию
// ============================================================

const developerAgent = new Agent({
  name: 'Developer',
  model: model('deepseek-v4-flash'),
  instructions: `
Ты Node.js разработчик. Реализуй этап по заданию архитектора.
Верни ПОЛНЫЙ список файлов этапа (path + content).

Стек: Node.js 20+, Express 4, better-sqlite3, zod.

Правила:
- ES modules (import/export). package.json уже с "type": "module"
- src/app.js экспортирует createApp(db), возвращает Express app
- src/server.js импортирует createApp и слушает PORT
- better-sqlite3 синхронный, prepared statements, .run()/.get()/.all()
- zod: parse() в начале обработчика, ошибки → 422 {detail}
- Ошибки — res.status(code).json({detail})
- Без заглушек, без TODO
- Если есть замечания ревьюера — исправь ВСЕ
- Не трогай package.json, .env, node_modules
  `.trim(),
  outputType: z.object({
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })),
    explanation: z.string(),
  }),
  modelSettings: { temperature: 0.1, reasoning: { effort: 'low' } },
});

// ============================================================
// 3. REVIEWER — ревьюит код по критериям
// ============================================================

const reviewerAgent = new Agent({
  name: 'ArchitectReviewer',
  model: model('deepseek-v4-flash'),
  instructions: `
Ты senior-архитектор. Ревьюишь Node.js код разработчика по критериям этапа.

Проверь:
1. Все критерии выполнены?
2. Код синтаксически валиден? (ESM, импорты с правильными путями)
3. Нет заглушек/TODO?
4. HTTP-контракты: коды ответов, поля, формат ошибок {detail}
5. better-sqlite3 используется корректно (prepared statements, синхронно)

Верни:
- approved: true только если ВСЁ ок
- feedback: 1–3 предложения
- criticalIssues: "file:line — проблема — как исправить"

НЕ придирайся к стилю, докстрингам, форматированию — только функциональность.
  `.trim(),
  outputType: z.object({
    approved: z.boolean(),
    feedback: z.string(),
    criticalIssues: z.array(z.string()),
  }),
  modelSettings: { temperature: 0, reasoning: { effort: 'low' } },
});

// ============================================================
// 4. ORCHESTRATOR
// ============================================================

type Stage = {
  id: string; title: string;
  files: string[]; criteria: string[]; dependsOn: string[];
};

type CodeFile = { path: string; content: string };

async function developProject(tz: string, outDir: string) {
  // --- фаза 1: план ---
  console.log('📋 Архитектор планирует...');
  const planResult = await run(plannerAgent, tz, { maxTurns: 3 });
  const stages: Stage[] = planResult.finalOutput.stages.slice(0, MAX_STAGES);
  console.log(`📋 Этапов: ${stages.length}`);
  for (const s of stages) {
    console.log(`   • ${s.id}: ${s.title} (${s.files.length} файлов)`);
  }

  // --- фаза 2: цикл по этапам ---
  const allFiles = new Map<string, string>();   // path → content
  const report: Array<{
    id: string; approved: boolean; iterations: number;
    issues: string[];
  }> = [];

  for (const stage of stages) {
    console.log(`\n🏗️  ${stage.id}: ${stage.title}`);

    let feedback = '';
    let approved = false;
    let files: CodeFile[] = [];
    let lastIssues: string[] = [];
    let iteration = 0;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      iteration = iter + 1;

      // --- dev ---
      console.log(`   🔨 dev, итерация ${iteration}`);
      const devInput = buildDevInput(stage, allFiles, feedback);
      const devResult = await run(developerAgent, devInput, { maxTurns: 3 });
      files = devResult.finalOutput.files;

      // валидация, что dev не вернул мусор
      if (!files.length) {
        console.warn('   ⚠️  dev вернул 0 файлов — прерываю этап');
        break;
      }

      // --- review ---
      console.log(`   🔍 review, итерация ${iteration}`);
      const reviewInput = buildReviewInput(stage, files);
      const reviewResult = await run(reviewerAgent, reviewInput, { maxTurns: 3 });
      const review = reviewResult.finalOutput;

      if (review.approved) {
        console.log('   ✅ approved');
        approved = true;
        break;
      }

      feedback = [review.feedback, ...review.criticalIssues]
        .filter(Boolean)
        .join('\n');
      lastIssues = review.criticalIssues;
      console.log(`   ❌ не прошло: ${review.criticalIssues.length} issues`);
      console.log(`      ${review.feedback.slice(0, 120)}`);
    }

    if (!approved) {
      console.warn(
        `   ⚠️  этап ${stage.id} не одобрен за ${MAX_ITER} итераций — беру последнюю версию`,
      );
    }

    for (const f of files) allFiles.set(f.path, f.content);
    report.push({
      id: stage.id, approved, iterations: iteration, issues: lastIssues,
    });
  }

  // --- фаза 3: запись на диск ---
  await writeFiles(outDir, allFiles);
  return { files: allFiles, report };
}

// ============================================================
// helpers
// ============================================================

function buildDevInput(
  stage: Stage,
  allFiles: Map<string, string>,
  feedback: string,
): string {
  const depFiles = stage.dependsOn
    .flatMap((id) => {
      // ищем файлы, которые этот этап произвёл — по префиксу или по списку
      return [...allFiles.entries()].filter(([p]) =>
        p.includes(`/${id}`) || p.includes(id.split('_').pop()!),
      );
    })
    .map(([p, c]) => `--- ${p} ---\n${c}`)
    .join('\n\n');

  return [
    `# Этап: ${stage.title} (${stage.id})`,
    ``,
    `## Файлы этапа:`,
    ...stage.files.map((f) => `- ${f}`),
    ``,
    `## Критерии приёмки:`,
    ...stage.criteria.map((c) => `- ${c}`),
    depFiles ? `\n## Готовые зависимости:\n${depFiles}` : '',
    feedback ? `\n## Замечания ревьюера (исправь все):\n${feedback}` : '',
  ].filter(Boolean).join('\n');
}

function buildReviewInput(stage: Stage, files: CodeFile[]): string {
  return [
    `# Критерии этапа ${stage.id}:`,
    ...stage.criteria.map((c) => `- ${c}`),
    ``,
    `# Код на ревью:`,
    ...files.map((f) => `--- ${f.path} ---\n${f.content}`),
  ].join('\n');
}

async function writeFiles(outDir: string, files: Map<string, string>) {
  for (const [path, content] of files) {
    const fullPath = join(outDir, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
    console.log(`📝 ${path}`);
  }
}

// ============================================================
// main
// ============================================================

const tz = await readFile('./src/assistant/playground/TZ.md', 'utf8');
const { report } = await developProject(tz, './generated');

console.log('\n📊 Итог:');
for (const r of report) {
  const status = r.approved ? '✅' : '⚠️ ';
  console.log(`   ${status} ${r.id} — ${r.iterations} итераций`);
}
