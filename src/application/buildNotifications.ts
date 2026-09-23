// src/application/buildNotifications.js
import { buildRosterIndex } from '../domain/roster.js';
import { buildDayNotifications } from '../domain/notifications.js';

export const createBuildNotifications = () =>
  ({ days, roster, today, greeting }) => {
    const studentIdx = buildRosterIndex(roster.students);
    const teacherIdx = buildRosterIndex(roster.teachers);

    const notifications = days.map((day) =>
      buildDayNotifications(day, {
        studentIndex: studentIdx.index,
        teacherIndex: teacherIdx.index,
        today,
        greeting,
      })
    );

    return {
      generatedAt: new Date().toISOString(),
      today,
      conflicts: [...studentIdx.conflicts, ...teacherIdx.conflicts],
      notifications,
    };
  };