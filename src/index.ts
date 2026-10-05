import { createConfig } from './config.js';
import { createAuthClient } from './adapters/googleAuth.js';
import { connectToSheet } from './adapters/googleSheets.js';
import { createRosterLoader } from './adapters/rosterSource.js';
import { createBuildScheduleForDates } from './application/buildScheduleForDates.js';
import { createBuildNotifications } from './application/buildNotifications.js';
import { createSendNotifications } from './application/sendNotifications.js';
import { createVkClient } from './adapters/vk.js';
import { createJournal } from './adapters/journal.js';
import { saveJsonTo } from './adapters/jsonFile.js';
import { toIsoDate, toDdMmYyyy } from './utils/dates.js';
import { renderFailureReport } from './domain/reports.js';
import { formatRelativeDay } from './domain/notifications';
import { createSendChatSummary } from './application/sendChatSummary';
import creds from '../service_account.json' with { type: 'json' };

const main = async () => {
  const dates = ['01.09.2026', '02.09.2026'];
  //const dates = [today, addDays(today, 1)]
  const today = toDdMmYyyy(new Date());
  

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

  // ---------- План уведомлений ----------
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

  // ---------- Отправка ----------
  const vkClient = createVkClient({ token: process.env.VK_ACCESS_TOKEN });
  const journal = createJournal(`${config.paths.outputDir}/journal.json`);
  const sendNotifications = createSendNotifications({ vkClient, journal });

  const result = await sendNotifications({ plan, runDate: today });

  const reportFile = `send-report-${dates.map(toIsoDate).join('_')}.json`;
  await save(reportFile, result);
  console.log(`💾 ${config.paths.outputDir}/${reportFile}`);

  // ---------- Отчёт админу ----------
  const adminId = Number(process.env.VK_ADMIN_USER_ID);
  if (adminId) {
    const reportText = renderFailureReport({
      failed: result.failed,
      skipped: result.skipped,
      sentCount: result.sent.length,
    });
    try {
      await vkClient.send({ userId: adminId, text: reportText });
      console.log('📨 Отчёт отправлен админу');
    } catch (e) {
      console.error('❌ Не удалось отправить отчёт админу:', e.message);
    }
  } else {
    console.warn('⚠️ VK_ADMIN_USER_ID не задан — отчёт не отправлен');
  }

  const daysForChat = days.map((d) => ({
  ...d,
  relativeDay: formatRelativeDay(d.date, today),
}));
const sendChatSummary = createSendChatSummary({ vkClient, journal });
const chatResult = await sendChatSummary({
  days: daysForChat,
  runDate: today,
  peerId: config.notifications.chatPeerId,
});

if (chatResult.sent) {
  console.log('📢 Сводка отправлена в чат');
} else if (chatResult.skipped) {
  console.log(`↩️ Сводка пропущена: ${chatResult.reason}`);
} else {
  console.error(`❌ Ошибка отправки сводки: ${chatResult.error}`);
}
  // ---------- Сводка ----------
  console.log(`\n✅ отправлено: ${result.sent.length}`);
  console.log(`↩️ пропущено:  ${result.skipped.length}`);
  console.log(`⚠️ ошибок:     ${result.failed.length}`);
  if (result.failed.length) console.table(result.failed.map(({ fullName, role, reason }) => ({ fullName, role, reason })));
};

main().catch((e) => { console.error(e); process.exit(1); });