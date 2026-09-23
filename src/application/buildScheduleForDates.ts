import { lessonFromRow, isLessonEmpty } from '../domain/lesson.js';
import { buildSlots } from '../domain/slots.js';
import { buildDaySchedule } from '../domain/schedule.js';

/**
 * @param {Object} deps
 * @param {() => Promise<Array>} deps.fetchAllRows — порт к источнику данных
 */

export const createBuildScheduleForDates = ({ fetchAllRows }) =>
  async (config, dates) => {
    const { columns } = config.schedule; // ← явно
    const rows = await fetchAllRows();

    const lessons = rows
      .map(lessonFromRow(columns))
      .filter((l) => !isLessonEmpty(l));

    const lessonsByDate = lessons.reduce((acc, l) => {
      if (!dates.includes(l.date)) return acc;
      (acc[l.date] ??= []).push(l);
      return acc;
    }, {});

    const slots = buildSlots(config.schedule); // ← явно
    const makeDay = buildDaySchedule(slots);

    return dates.map((date) => makeDay(date)(lessonsByDate[date] ?? []));
  };