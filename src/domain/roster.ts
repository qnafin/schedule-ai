// src/domain/roster.js
export const normalizeName = (s) =>
  String(s ?? '').trim().replace(/\s+/g, ' ');

const tokens = (s) => normalizeName(s).toLowerCase().split(' ').filter(Boolean);
const sortedKey = (s) => tokens(s).sort().join(' ');

const parseAliases = (s) =>
  String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

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

// "Нуримова Турсуной" + ["Таня","Татьяна"] →
//   ["нуримова турсуной", "нуримова таня", "таня", "нуримова татьяна", "татьяна"]
const buildKeys = (fullName, aliases) => {
  const t = tokens(fullName);
  if (!t.length) return [];
  const surname = t[0];
  const keys = new Set([sortedKey(fullName)]);
  for (const a of aliases) {
    keys.add(sortedKey(`${surname} ${a}`));
    keys.add(sortedKey(a));
  }
  return [...keys];
};

export const personFromRow = (columns, row) => {
  const read = (key) => (key ? row.get(columns[key]) : null);
  const fullName = normalizeName(read('fullName'));
  if (!fullName) return null;
  const aliases = parseAliases(read('aliases'));
  return {
    id: String(read('id') ?? '').trim(),
    fullName,
    channel: parseChannel(read('notify')),
    aliases,
    vkLink: String(read('vkLink') ?? '').trim(),
    vk: parseVkLink(read('vkLink')),
    phone: String(read('phone') ?? '').trim(),
    keys: buildKeys(fullName, aliases),
  };
};

export const buildRosterIndex = (people) => {
  const index = new Map();
  const conflicts = [];
  for (const p of people) {
    for (const key of p.keys) {
      const existing = index.get(key);
      if (existing && existing.id !== p.id) {
        conflicts.push({ key, a: existing.fullName, b: p.fullName });
        continue;
      }
      if (!existing) index.set(key, p);
    }
  }
  return { index, conflicts };
};

export const resolvePerson = (index, name) =>
  name ? index.get(sortedKey(name)) ?? null : null;

export const splitNames = (s) =>
  String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);