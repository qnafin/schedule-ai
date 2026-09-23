// src/index.js
import { createConfig } from './config.js';
import { createAuthClient } from './adapters/googleAuth.js';
import { connectToSheet } from './adapters/googleSheets.js';
import { createRosterLoader } from './adapters/rosterSource.js';
import { createBuildScheduleForDates } from './application/buildScheduleForDates.js';
import { saveJsonTo } from './adapters/jsonFile.js';
import creds from '../service_account.json' with { type: 'json' };

// "01.09.2026" → "2026-09-01" (ISO, чтобы файлы сортировались)
const toIsoDate = (d) => {
  const [dd, mm, yyyy] = d.split('.');
  return `${yyyy}-${mm}-${dd}`;
};

const main = async () => {
  const dates = ['01.09.2026', '02.09.2026'];
  const config = createConfig();

  const authClient = createAuthClient(creds);
  const { doc, sheet } = await connectToSheet(config, authClient);

  const save = saveJsonTo(config.paths.outputDir);

  // ---------- 1. Расписание ----------
  const buildSchedule = createBuildScheduleForDates({
    fetchAllRows: () => sheet.getRows(),
  });
  const days = await buildSchedule(config, dates);

  const scheduleFile = `schedule-${dates.map(toIsoDate).join('_')}.json`;
  await save(scheduleFile, days);
  console.log(`💾 ${config.paths.outputDir}/${scheduleFile}`);

  // ---------- 2. Справочники ----------
  const loadRoster = createRosterLoader(doc, config);
  const { students, teachers } = await loadRoster();

  await save('students.json', students);
  await save('teachers.json', teachers);
  console.log(`💾 ${config.paths.outputDir}/students.json (${students.length})`);
  console.log(`💾 ${config.paths.outputDir}/teachers.json (${teachers.length})`);

};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});