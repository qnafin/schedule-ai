export const pad2 = (n) => String(n).padStart(2, '0');

export const text = (v) => (v == null ? '' : String(v).trim());

export const normalizeDate = (v) => {
  if (!v) return '';
  if (v instanceof Date) {
    return `${pad2(v.getDate())}.${pad2(v.getMonth() + 1)}.${v.getFullYear()}`;
  }
  return String(v).trim();
};

export const normalizeTime = (v) => {
  if (!v) return '';
  if (v instanceof Date) return `${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${pad2(m[1])}:${m[2]}` : String(v).trim();
};