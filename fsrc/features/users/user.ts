export type VkRef =
  | { type: 'id'; value: number }
  | { type: 'screen'; value: string };

export type NotifyChannel = 'vk' | 'phone';

export type User = {
  id: string;
  fullName: string;
  channel: NotifyChannel | null;
  vkLink: string;
  vk: VkRef | null;
  phone: string;
};

export type UserColumns = {
  id: string;
  fullName: string;
  notify?: string | null;
  vkLink?: string | null;
  phone?: string | null;
};

/** Минимальный контракт строки таблицы — без зависимости на google-spreadsheet */
export type RowReader = (column: string) => unknown;

export const normalizeName = (s: unknown): string =>
  String(s ?? '').trim().replace(/\s+/g, ' ');

/** Ключ для матчинга: имя без учёта регистра и порядка слов */
export const nameKey = (s: unknown): string =>
  normalizeName(s).toLowerCase().split(' ').filter(Boolean).sort().join(' ');

export const parseVkLink = (url: unknown): VkRef | null => {
  const s = String(url ?? '').trim();
  if (!s) return null;
  const m = s.match(/vk\.(?:com|ru)\/([A-Za-z0-9_.]+)/i);
  if (!m) return null;
  const handle = m[1];
  const idMatch = handle.match(/^id(\d+)$/i);
  if (idMatch) return { type: 'id', value: Number(idMatch[1]) };
  return { type: 'screen', value: handle };
};

const parseChannel = (raw: unknown): NotifyChannel | null => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'вк') return 'vk';
  if (v === 'телефон') return 'phone';
  return null;
};

export const userFromRow = (
  columns: UserColumns,
  read: RowReader,
): User | null => {
  const get = (key?: string | null) => (key ? read(key) : null);

  const fullName = normalizeName(get(columns.fullName));
  if (!fullName) return null;

  const vkLink = String(get(columns.vkLink) ?? '').trim();

  return {
    id: String(get(columns.id) ?? '').trim(),
    fullName,
    channel: parseChannel(get(columns.notify)),
    vkLink,
    vk: parseVkLink(vkLink),
    phone: String(get(columns.phone) ?? '').trim(),
  };
};