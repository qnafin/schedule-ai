import { pad2 } from "./text";
/**
 * Приводит дату к ISO `YYYY-MM-DD`.
 * Понимает: Date, `01.09.2026`, `2026-09-01`.
 * Непонятное возвращает как есть (обрезанным).
 */
export const normalizeDate = (v: unknown): string => {
  if (!v) return '';
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  const s = String(v).trim();
  const ru = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ru) return `${ru[3]}-${pad2(ru[2])}-${pad2(ru[1])}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
};

/** Приводит время к `HH:MM`. */
export const normalizeTime = (v: unknown): string => {
  if (!v) return '';
  if (v instanceof Date) return `${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${pad2(m[1])}:${m[2]}` : s;
};

/** Обратно в русский формат — для отображения. */
export const toRuDate = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};


const isoToUtc = (iso: string): number | null => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

/** Разница в днях: to - from. 0, если что-то не парсится. */
export const diffDays = (fromIso: string, toIso: string): number => {
  const a = isoToUtc(fromIso);
  const b = isoToUtc(toIso);
  if (a === null || b === null) return 0;
  return Math.round((b - a) / 86_400_000);
};

export const todayIso = (): string => new Date().toISOString().slice(0, 10);