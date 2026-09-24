import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const createJournal = (path) => {
  const load = async () => {
    try {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
    } catch {
      return new Set();
    }
  };

  const save = async (set) => {
    await mkdir(dirname(path), { recursive: true });
    const sorted = [...set].sort();
    await writeFile(path, JSON.stringify(sorted, null, 2), 'utf8');
  };

  return { load, save };
};