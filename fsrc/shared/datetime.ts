export const pad2 = (n: number | string): string => String(n).padStart(2, '0');

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

export const normalizeTime = (v: unknown): string => {
  if (!v) return '';
  if (v instanceof Date) return `${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${pad2(m[1])}:${m[2]}` : s;
};

const isoToUtc = (iso: string): number | null => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export const diffDays = (fromIso: string, toIso: string): number => {
  const a = isoToUtc(fromIso);
  const b = isoToUtc(toIso);
  if (a === null || b === null) return 0;
  return Math.round((b - a) / 86_400_000);
};

/** Текущая дата (YYYY-MM-DD), локальное время сервера. */
export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Текущее время (HH:MM), локальное время сервера. */
export const nowTime = (): string => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** Прибавить N дней к ISO-дате. */
export const addDays = (iso: string, days: number): string => {
  const utc = isoToUtc(iso);
  if (utc === null) return iso;
  const d = new Date(utc);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};