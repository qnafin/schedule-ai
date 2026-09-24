const ROLE_LABEL = { student: 'ученик', teacher: 'преподаватель' };

const formatLessons = (lessons) =>
  lessons
    .map((l) => `   ${l.date} ${l.time} — ${l.type} (${l.className})`)
    .join('\n');

export const renderFailureReport = ({ failed, skipped, sentCount }) => {
  if (!failed.length) {
    return `✅ Рассылка завершена\nОтправлено: ${sentCount}\nПропущено (уже получали): ${skipped.length}`;
  }

  const lines = failed.map((f, i) => {
    const head = `${i + 1}. ${f.fullName} (${ROLE_LABEL[f.role] ?? f.role}) — ${f.reason}`;
    const body = formatLessons(f.lessons);
    return `${head}\n${body}`;
  });

  return [
    `⚠️ Не удалось отправить: ${failed.length}`,
    `✅ Отправлено: ${sentCount}`,
    `↩️ Пропущено (уже получали): ${skipped.length}`,
    '',
    ...lines,
  ].join('\n');
};