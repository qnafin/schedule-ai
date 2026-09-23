// src/adapters/jsonFile.js
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const saveJson = async (path, data) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
};

export const saveJsonTo = (dir) => (name, data) =>
  saveJson(join(dir, name), data);