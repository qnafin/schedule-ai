import { lessonFromRow, isLessonEmpty } from '../domain/lesson.js';
import { buildSlots } from '../domain/slots.js';
import { buildDaySchedule } from '../domain/schedule.js';

/**
 * @param {Object} deps
 * @param {() => Promise<Array>} deps.fetchAllRows — порт к источнику данных
 */
export const createBuildScheduleForDates = ({ fetchAllRows }) =>
  /**
   * @param {Object} config
   * @param {string[]} dates
   */
  async (config, dates) => {
    const rows = await fetchAllRows();

    const lessons = rows
      .map(lessonFromRow(config.columns))
      .filter((l) => !isLessonEmpty(l));

    const lessonsByDate = lessons.reduce((acc, l) => {
      if (!dates.includes(l.date)) return acc;
      (acc[l.date] ??= []).push(l);
      return acc;
    }, {});

    const slots = buildSlots(config);
    const makeDay = buildDaySchedule(slots);

    return dates.map((date) => makeDay(date)(lessonsByDate[date] ?? []));
  };