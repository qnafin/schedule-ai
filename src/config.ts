// src/config.js
export const createConfig = (overrides = {}) => ({
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  notifications: {
    greeting: "Барабанное утро!",
    chatPeerId: Number(process.env.VK_CHAT_PEER_ID) || null,
  },
  paths: {
    outputDir: "data",
  },
  schedule: {
    sheetName: "Расписание",
    columns: {
      id: "ID",
      date: "Дата",
      time: "Время",
      roomName: "Класс",
      type: "Тип",
      students: "Ученики",
      teachers: "Преподаватели",
    },
    workStartHour: 10,
    workEndHour: 22,
    slotMinutes: 60,
  },
  rooms: {
    sheetName: "Классы",
    columns: {
      id: "№",
      name: "Наименование",
    },
  },
  users: {
    students: {
      sheetName: "Ученики",
      columns: {
        id: "№",
        fullName: "ФИО",
        notify: "Уведомлять",
        aliases: "Синонимы",
        vkLink: "vk_link",
        phone: "Телефон",
      },
    },
    teachers: {
      sheetName: "Преподаватели",
      columns: {
        id: "№",
        fullName: "ФИО",
        notify: "Уведомлять",
        aliases: null,
        vkLink: "vk_link",
        phone: null,
      },
    },
  },

  ...overrides,
});
