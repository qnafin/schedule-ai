export const pad2 = (n: number | string): string => String(n).padStart(2, '0');

export const text = (v: unknown): string => (v == null ? '' : String(v).trim());

/** Разбивает "Иванов Иван, Петров Пётр" на ["Иванов Иван", "Петров Пётр"] */
export const splitNames = (s: unknown): string[] =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);