// simple-pev-roman.ts
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
// ТЗ — с явными тестовыми кейсами (Definition of Done)
// ============================================================

const TASK = `
Напиши функцию на JavaScript: romanToInt(s) → number.

Правила:
- Принимает строку с римским числом (только UPPERCASE: I, V, X, L, C, D, M)
- Возвращает целое 1–3999
- Кидает new Error(...) для невалидного входа

ОБЯЗАТЕЛЬНЫЕ ТЕСТОВЫЕ КЕЙСЫ (все должны пройти):
- "I"       → 1
- "IV"      → 4
- "IX"      → 9
- "LVIII"   → 58
- "MCMXCIV" → 1994
- ""        → throws Error
- "IIII"    → throws Error   (нельзя 4 раза I подряд)
- "VV"      → throws Error   (V не повторяется)
- "IC"      → throws Error   (I перед C недопустимо)
- "MMMM"    → throws Error   (превышает 3999)
- "iiii"    → throws Error   (только uppercase)
- null      → throws Error
`.trim();

// ============================================================
// DEVELOPER
// ============================================================

const developer = new Agent({
  name: 'Developer',
  model: model('deepseek-v4-flash'),
  instructions: `
Ты программист. Получаешь задачу и, возможно, замечания ревьюера.
Думай, потом пиши.

Верни:
- thinking: рассуждения (какие кейсы видишь, как решаешь)
- code: готовый код функции
  `.trim(),
  outputType: z.object({
    thinking: z.string(),
    code: z.string(),
  }),
  modelSettings: { temperature: 0.2, reasoning: { effort: 'low' } },
});

// ============================================================
// REVIEWER — с чеклистом по каждому кейсу
// ============================================================

const reviewer = new Agent({
  name: 'Reviewer',
  model: model('deepseek-v4-flash'),
  instructions: `
Ты senior-ревьюер. Получаешь ТЗ с тестовыми кейсами и код.
Пройди по КАЖДОМУ тестовому кейсу мысленно. Выполни код руками.

Особое внимание:
- Валидация "IIII", "VV", "IC", "MMMM" — жадный алгоритм (сумма с вычитанием
  меньшего перед большим) ПРОЙДЁТ эти кейсы без ошибки, но это НЕВЕРНО
  по ТЗ. Если код не валидирует — это критический баг.
- null/"" — должны кидать Error, не возвращать 0.

Верни:
- thinking: для каждого кейса — прошёл / провалился / почему
- approved: true только если ВСЕ 12 кейсов прошли
- issues: конкретные "кейс X → ожидалось Y, получено Z"
  `.trim(),
  outputType: z.object({
    thinking: z.string(),
    approved: z.boolean(),
    issues: z.array(z.string()),
  }),
  modelSettings: { temperature: 0, reasoning: { effort: 'low' } },
});

// ============================================================
// ORCHESTRATOR
// ============================================================

const MAX_ITER = 3;
const indent = (s: string) =>
  s.split('\n').map((l) => '  ' + l).join('\n');

async function main() {
  console.log('📋 TASK:\n' + indent(TASK));
  console.log('='.repeat(72));

  let feedback = '';
  let lastCode = '';

  for (let i = 1; i <= MAX_ITER; i++) {
    console.log(`\n🔄 Итерация ${i}/${MAX_ITER}\n`);

    // --- DEV ---
    const devInput = [
      `# Задача:\n${TASK}`,
      feedback ? `# Замечания ревьюера (исправь ВСЕ):\n${feedback}` : '',
      i > 1 ? `# Твой прошлый код:\n${lastCode}` : '',
    ].filter(Boolean).join('\n\n');

    const devResult = await run(developer, devInput);
    const dev = devResult.finalOutput!;
    lastCode = dev.code;

    console.log('← DEVELOPER думает:');
    console.log(indent(dev.thinking));
    console.log('\n← DEVELOPER код:\n' + indent(dev.code) + '\n');

    // --- REVIEW ---
    const reviewResult = await run(
      reviewer,
      `# Задача:\n${TASK}\n\n# Код:\n${dev.code}`,
    );
    const review = reviewResult.finalOutput!;

    console.log('← REVIEWER думает:');
    console.log(indent(review.thinking));
    console.log(`\n← ВЕРДИКТ: ${review.approved ? '✅ APPROVED' : '❌ REJECTED'}`);
    if (!review.approved) {
      console.log('  Проблемы:');
      review.issues.forEach((x) => console.log(`   • ${x}`));
    }
    console.log();

    if (review.approved) {
      console.log(`🎉 Готово за ${i} итераций\n`);
      console.log('📄 Финальный код:\n' + lastCode);
      return;
    }

    feedback = review.issues.map((x, j) => `${j + 1}. ${x}`).join('\n');
  }

  console.log(`⚠️  Не одобрено за ${MAX_ITER}. Последняя версия:\n${lastCode}`);
}

main().catch((e) => { console.error(e); process.exit(1); });