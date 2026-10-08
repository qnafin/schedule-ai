export type { Lesson, LessonColumns } from './lesson';

export {
  lessonFromRow,
  isLessonEmpty,
  isLessonBooked,
} from './lesson';

export type { SlotsConfig } from './slots';
export { buildSlots } from './slots';

export type { DaySchedule, Availability } from './daySchedule';
export { buildDaySchedule,  roomNamesOf } from './daySchedule';

export type {
  ScheduleConfig,
  GetScheduleOptions,
} from './services/getSchedule';
export {
  getSchedule,
  listScheduleDates,
} from './services/getSchedule';

export { registerScheduleTools } from './mcp';