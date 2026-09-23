import { createConfig } from './config';
import { createAuthClient } from './adapters/googleAuth';
import { connectToSheet, createRowsFetcher } from './adapters/googleSheets';
import { createBuildScheduleForDates } from './application/buildScheduleForDates';
import { saveJson } from './adapters/jsonFile';
import creds from '../schedule-ai-509407-07d997950c3e.json' with { type: 'json' };

const main = async () => {
  const dates = ['01.09.2026', '02.09.2026'];
  const config = createConfig();

  // Собираем зависимости
  const authClient = createAuthClient(creds);
  const sheet = await connectToSheet(config, authClient);
  const fetchAllRows = createRowsFetcher(sheet);

  // Инжектируем порт в use case
  const buildSchedule = createBuildScheduleForDates({ fetchAllRows });

  // Выполняем
  const days = await buildSchedule(config, dates);

  const fileName = `schedule-${dates
    .map((d) => d.replaceAll('.', '-'))
    .join('_')}.json`;

  await saveJson(fileName, days);
  console.log(`💾 Сохранено: ${fileName}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});