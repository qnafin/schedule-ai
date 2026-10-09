import { z } from 'zod';
import type { FastMCP } from 'fastmcp';
import type { JWT } from 'google-auth-library';

import { getRooms } from './services/getRooms';
import type { RoomsConfig } from './services/getRooms';

type Deps = {
  config: RoomsConfig;
  authClient: JWT;
};

export const registerRoomsTools = (
  server: FastMCP,
  { config, authClient }: Deps,
) => {
  server.addTool({
    name: 'list_rooms',
    description: 'Список всех классов (направлений, помещений) школы.',
    parameters: z.object({}),
    execute: async () => {
      const rooms = await getRooms(config, authClient);
      return JSON.stringify(rooms, null, 2);
    },
  });
};