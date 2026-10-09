import type { JWT } from 'google-auth-library';

import { getUsers } from '../features/users/services/getUsers.js';
import { resolveByVkId } from '../features/users/services/resolveByVkId.js';
import { getRooms } from '../features/rooms/services/getRooms.js';
import { getSchedule } from '../features/schedule/services/getSchedule.js';
import type { Sender } from '../features/users/services/resolveByVkId.js';
import type { Config } from '../config';

export interface BotDeps {
  resolveSender: (vkId: number) => Promise<Sender | null>;
  resolveRoom: (roomName: string) => Promise<{ id: string; name: string } | null>;
  getScheduleForDate: (date: string) => Promise<unknown>;
}

export const createBotDeps = (config: Config, authClient: JWT): BotDeps => {
  const resolveSender = async (vkId: number): Promise<Sender | null> => {
    const users = await getUsers(config, authClient);
    return resolveByVkId(users, vkId);
  };

  const resolveRoom = async (roomName: string) => {
    const rooms = await getRooms(config, authClient);
    const needle = roomName.trim().toLowerCase();
    return rooms.find((r) => r.name.toLowerCase() === needle) ?? null;
  };

  const getScheduleForDate = async (date: string) => {
    const days = await getSchedule(config, authClient, { dates: [date] });
    return days[0] ?? null;
  };

  return { resolveSender, resolveRoom, getScheduleForDate };
};