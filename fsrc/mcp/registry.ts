import { FastMCP } from '@prefecthq/fastmcp-ts/server';

import { createConfig } from '../config';
import { createGoogleAuth } from '../infrastructure/google/auth';

import { registerUserTools } from '../features/users/mcp';
import {client_email, private_key} from '../../service_account.json' with { type: 'json' };

export const buildServer = (): FastMCP => {
  const config = createConfig();

  const authClient = createGoogleAuth({
    googleServiceAccountEmail: client_email,
    googlePrivateKey: private_key,
  });

  const server = new FastMCP({ name: 'schedule-ai', version: '0.1.0' });

  // Регистраторы фич. Новая фича — новая строка здесь.
  registerUserTools(server, { config, authClient });
  // registerScheduleTools(server, { config, authClient });   // когда будет готов

  return server;
};