#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createConfig } from '../config';
import {
  client_email,
  private_key,
} from '../../service_account.json' with { type: 'json' };

import { createGoogleAuth } from '../infrastructure/google/auth';
import { createVkClient } from '../infrastructure/vk';

import { getNotifications, runDaily } from '../features/notifications';

const parseArg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const hasFlag = (name: string): boolean => process.argv.includes(name);
const parseDates = (): string[] | undefined => {
  const raw = parseArg('--dates');
  if (!raw) return undefined;
  const d = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return d.length ? d : undefined;
};

const save = async (dir: string, name: string, data: unknown) => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify(data, null, 2), 'utf8');
};

const main = async (): Promise<void> => {
  const config = createConfig();
  const { outputDir } = config.paths;

  const dryRun = hasFlag('--dry-run');
  const noSave = hasFlag('--no-save');
  const noUsers = hasFlag('--no-users');
  const noChat = hasFlag('--no-chat');

  const dates = parseDates();

  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });

  const vkToken = process.env.VK_ACCESS_TOKEN;
  const chatPeerId = Number(process.env.VK_CHAT_PEER_ID) || undefined;
  const adminUserId = Number(process.env.VK_ADMIN_USER_ID) || undefined;

  // ----- Сохранить план для отладки -----
  if (!noSave) {
    const plan = await getNotifications(config, authClient, { dates });
    const suffix = dates?.join('_') ?? 'all';
    await save(outputDir, `notifications-${suffix}.json`, plan);
    console.log(`💾 ${outputDir}/notifications-${suffix}.json`);
  }

  // ----- Dry-run: показать план и выйти -----
  if (dryRun) {
    const plan = await getNotifications(config, authClient, { dates });
    console.log(`📅 today=${plan.today}, notifications=${plan.notifications.length}`);
    console.log('\n🔎 DRY RUN\n');
    for (const n of plan.notifications) {
      console.log(`--- ${n.relativeDay}, ${n.fullName} (${n.role}) ---`);
      console.log(n.text, '\n');
    }
    return;
  }

  if (!vkToken) throw new Error('VK_ACCESS_TOKEN не задан');

  const vk = createVkClient({ token: vkToken });
  const scope: 'all' | 'users' | 'chat' =
    noUsers && !noChat ? 'chat' : !noUsers && noChat ? 'users' : 'all';

  const result = await runDaily(config, authClient, vk, {
    adminUserId,
    chatPeerId,
    scope,
    dates,
  });

  if (result.personal) {
    console.log(
      `✅ users: sent=${result.personal.counts.sent} ` +
        `skipped=${result.personal.counts.skipped} ` +
        `failed=${result.personal.counts.failed}`,
    );
  }
  if (result.admin) {
    console.log(`📤 admin report: ${result.admin.status}`);
  }
  if (result.chat) {
    console.log(`💬 chat: ${result.chat.status}`);
  }
  if (result.unresolved.length) {
    console.warn(`⚠️  unresolved: ${result.unresolved.length}`);
  }
};

main().catch((err) => {
  console.error('[daily] fatal:', err);
  process.exit(1);
});