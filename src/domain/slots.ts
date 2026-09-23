import { pad2 } from './normalizers';

export const buildSlots = ({ workStartHour, workEndHour, slotMinutes }) => {
  const slots = [];
  for (let m = workStartHour * 60; m < workEndHour * 60; m += slotMinutes) {
    slots.push(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
  }
  return slots;
};