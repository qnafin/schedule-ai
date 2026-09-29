// fsrc/cli/daily.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createConfig } from '../config';
import {client_email, private_key} from '../../service_account.json' with { type: 'json' };

import { createGoogleAuth } from '../infrastructure/google/auth';
import { getUsers } from '../features/users';
import { getSchedule } from '../features/schedule';

const save = async (dir: string, name: string, data: unknown): Promise<void> => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify(data, null, 2), 'utf8');
};

/** Достаёт --dates 2026-09-01,2026-09-02 из argv. Если не указано — undefined. */
const parseDatesArg = (): string[] | undefined => {
  const i = process.argv.indexOf('--dates');
  if (i === -1) return undefined;
  const raw = process.argv[i + 1];
  if (!raw) return undefined;
  const dates = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return dates.length ? dates : undefined;
};

const main = async (): Promise<void> => {
  const config = createConfig();

  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });
  // Пользователи
  const users = await getUsers(config, authClient);
  const { outputDir } = config.paths;

  await save(outputDir, 'students.json', users.students);
  await save(outputDir, 'teachers.json', users.teachers);

  console.log(`💾 ${outputDir}/students.json (${users.students.length})`);
  console.log(`💾 ${outputDir}/teachers.json (${users.teachers.length})`);

    // Расписание
  const dates = parseDatesArg();
  const days = await getSchedule(config, authClient, { dates });

  const name = dates
    ? `schedule-${dates.join('_')}.json`
    : 'schedule.json';

  await save(outputDir, name, days);
  console.log(
    `💾 ${outputDir}/${name} (${days.length} дн., ${days.reduce(
      (s, d) => s + d.totals.lessons,
      0,
    )} занятий)`,
  );
};

main().catch((err) => {
  console.error('[daily] fatal:', err);
  process.exit(1);
});