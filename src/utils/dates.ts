// src/utils/dates.js

export const pad2 = (n) => String(n).padStart(2, '0');

/** "01.09.2026" */
export const toDdMmYyyy = (date = new Date()) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;

/** "01.09.2026" + 1 → "02.09.2026" */
export const addDays = (dateStr, n) => {
  const [dd, mm, yyyy] = dateStr.split('.').map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd + n));
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};

/** "01.09.2026" → "2026-09-01" (для имён файлов) */
export const toIsoDate = (dateStr) => {
  const [dd, mm, yyyy] = dateStr.split('.');
  return `${yyyy}-${mm}-${dd}`;
};