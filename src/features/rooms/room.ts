export type Room = {
  id: string;
  name: string;
};

export type RoomColumns = {
  id: string;
  name: string;
};

export const roomFromRow = (
  columns: RoomColumns,
  get: (key: string) => unknown,
): Room | null => {
  const id = String(get(columns.id) ?? '').trim();
  const name = String(get(columns.name) ?? '').trim();
  if (!name) return null;
  return { id, name };
};