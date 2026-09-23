import { writeFile } from 'node:fs/promises';

export const saveJson = (path, data) =>
  writeFile(path, JSON.stringify(data, null, 2), 'utf8');