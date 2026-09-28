// fsrc/cli/daily.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createConfig } from '../config';
import {client_email, private_key} from '../../service_account.json' with { type: 'json' };

import { createGoogleAuth } from '../infrastructure/google/auth';
import { getUsers } from '../features/users';

const save = async (dir: string, name: string, data: unknown): Promise<void> => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify(data, null, 2), 'utf8');
};

const main = async (): Promise<void> => {
  const config = createConfig();

  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });

  const users = await getUsers(config, authClient);
  const { outputDir } = config.paths;

  await save(outputDir, 'students.json', users.students);
  await save(outputDir, 'teachers.json', users.teachers);

  console.log(`💾 ${outputDir}/students.json (${users.students.length})`);
  console.log(`💾 ${outputDir}/teachers.json (${users.teachers.length})`);
};

main().catch((err) => {
  console.error('[daily] fatal:', err);
  process.exit(1);
});