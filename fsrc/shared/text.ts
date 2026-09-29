export const text = (v: unknown): string => (v == null ? '' : String(v).trim());

export const pad2 = (n: number | string): string => String(n).padStart(2, '0');

