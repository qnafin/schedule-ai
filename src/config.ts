export const createConfig = (overrides = {}) => ({
  spreadsheetId: '1nZRSxBUWp_4b0WHFofv6iTCkFBEa-D71OWIKm_hl860',
  sheetName: 'Расписание',
  workStartHour: 10,
  workEndHour: 22,
  slotMinutes: 60,
  columns: {
    id: 'ID',
    date: 'Дата',
    time: 'Время',
    className: 'Класс',
    type: 'Тип',
    students: 'Ученики',
    teachers: 'Преподаватели',
  },
  ...overrides,
});