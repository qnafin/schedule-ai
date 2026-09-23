// src/domain/roster.js

export const normalizeName = (s) =>
  String(s ?? '').trim().replace(/\s+/g, ' ');

const parseAliases = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export const parseVkLink = (url) => {
  const s = String(url ?? '').trim();
  if (!s) return null;
  const m = s.match(/vk\.(?:com|ru)\/([A-Za-z0-9_.]+)/i);
  if (!m) return null;
  const handle = m[1];
  const idMatch = handle.match(/^id(\d+)$/i);
  if (idMatch) return { type: 'id', value: Number(idMatch[1]) };
  return { type: 'screen', value: handle };
};

const parseChannel = (raw) => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'вк') return 'vk';
  if (v === 'телефон') return 'phone';
  return null;
};

export const personFromRow = (columns, row) => {
  const read = (key) => (key ? row.get(columns[key]) : null);

  const fullName = normalizeName(read('fullName'));
  if (!fullName) return null;

  return {
    id: String(read('id') ?? '').trim(),
    fullName,
    channel: parseChannel(read('notify')),
    aliases: parseAliases(read('aliases')),
    vkLink: String(read('vkLink') ?? '').trim(),
    vk: parseVkLink(read('vkLink')),
    phone: String(read('phone') ?? '').trim(),
  };
};