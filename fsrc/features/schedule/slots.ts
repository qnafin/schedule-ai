import { pad2 } from '../../shared/text';

export type SlotsConfig = {
  workStartHour: number;
  workEndHour: number;
  slotMinutes: number;
};

export const buildSlots = ({
  workStartHour,
  workEndHour,
  slotMinutes,
}: SlotsConfig): string[] => {
  const slots: string[] = [];
  for (let m = workStartHour * 60; m < workEndHour * 60; m += slotMinutes) {
    slots.push(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
  }
  return slots;
};