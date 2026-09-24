export const DEFAULT_KIND = 'daily';

export const makeMessageKey = ({ kind, runDate, lessonDate, role, personId }) =>
  [kind, runDate, lessonDate, role, personId].join(':');