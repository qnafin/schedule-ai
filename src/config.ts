// src/config.js
export const createConfig = (overrides = {}) => ({
  spreadsheetId: "1nZRSxBUWp_4b0WHFofv6iTCkFBEa-D71OWIKm_hl860",
  notifications: {
    greeting: "Барабанное утро!",
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
      className: "Класс",
      type: "Тип",
      students: "Ученики",
      teachers: "Преподаватели",
    },
    workStartHour: 10,
    workEndHour: 22,
    slotMinutes: 60,
  },

  roster: {
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
        notify: null,
        aliases: null,
        vkLink: "vk_link",
        phone: null,
      },
    },
  },

  ...overrides,
});