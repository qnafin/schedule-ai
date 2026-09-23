// src/index.js
import { createConfig } from './config.js';
import { createAuthClient } from './adapters/googleAuth.js';
import { connectToSheet } from './adapters/googleSheets.js';
import { createRosterLoader } from './adapters/rosterSource.js';
import { createBuildScheduleForDates } from './application/buildScheduleForDates.js';
import { createBuildNotifications } from './application/buildNotifications.js';
import { saveJsonTo } from './adapters/jsonFile.js';
import { toIsoDate } from './utils/dates';
import creds from '../service_account.json' with { type: 'json' };

// ---------- Сводка ----------
const renderFreeByClass = (availabilityByClass) => {
  const entries = Object.entries(availabilityByClass);
  if (!entries.length) return ['  (нет данных о классах)'];

  return entries.map(([className, { free }]) => {
    const times = free.length ? free.join(', ') : '—';
    return `    ${className}: ${times}`;
  });
};

const printSummary = (plan, days) => {
  const daysByDate = new Map(days.map((d) => [d.date, d]));

  for (const day of plan.notifications) {
    const schedule = daysByDate.get(day.date);

    console.log(`\n=== ${day.date} (${day.relativeDay}) ===`);

    console.log(`  Свободные классы для ваших репетиций:`);
    if (schedule) {
      for (const line of renderFreeByClass(schedule.availabilityByClass)) {
        console.log(line);
      }
    } else {
      console.log('  (расписание за этот день не собрано)');
    }

    console.log(`  Уведомления:`);
    console.log(`    учеников: ${day.students.length}, преподавателей: ${day.teachers.length}`);
    for (const s of day.students) console.log(`    → ${s.fullName}: ${s.text}`);
    for (const t of day.teachers) console.log(`    → ${t.fullName}: ${t.text}`);

    if (day.unresolved.length) console.log(`  ⚠️ не найдены:`, day.unresolved);
  }

  if (plan.conflicts.length) {
    console.log(`\n⚠️ Конфликты в справочниках:`);
    console.table(plan.conflicts);
  }
};

// ---------- main ----------
const main = async () => {
  // Фиксированные даты — обе есть в таблице
  const dates = ['01.09.2026', '02.09.2026'];
  const today = dates[0]; // «сегодня» считаем первой датой из списка

  const config = createConfig();
  const authClient = createAuthClient(creds);
  const { doc, sheet } = await connectToSheet(config, authClient);
  const save = saveJsonTo(config.paths.outputDir);

  // ---------- Расписание ----------
  const buildSchedule = createBuildScheduleForDates({
    fetchAllRows: () => sheet.getRows(),
  });
  const days = await buildSchedule(config, dates);

  const scheduleFile = `schedule-${dates.map(toIsoDate).join('_')}.json`;
  await save(scheduleFile, days);
  console.log(`💾 ${config.paths.outputDir}/${scheduleFile}`);

  // ---------- Справочники ----------
  const loadRoster = createRosterLoader(doc, config);
  const roster = await loadRoster();

  await save('students.json', roster.students);
  await save('teachers.json', roster.teachers);
  console.log(`💾 ${config.paths.outputDir}/students.json (${roster.students.length})`);
  console.log(`💾 ${config.paths.outputDir}/teachers.json (${roster.teachers.length})`);

  // ---------- Уведомления ----------
  const buildNotifications = createBuildNotifications();
  const plan = buildNotifications({
    days,
    roster,
    today,
    greeting: config.notifications.greeting,
  });

  const notificationsFile = `notifications-${dates.map(toIsoDate).join('_')}.json`;
  await save(notificationsFile, plan);
  console.log(`💾 ${config.paths.outputDir}/${notificationsFile}`);

  // ---------- Сводка ----------
  printSummary(plan, days);
};

main().catch((e) => { console.error(e); process.exit(1); });