/**
 * Router уже отфильтровал — сюда попадают только
 * чистые приветствия и благодарности.
 * Проверки длины не нужны.
 */
export const smallTalk = (input: string): string => {
  const lower = input.toLowerCase();

  if (/(привет|здравств|хай|добрый|хаюшки)/.test(lower)) {
    return 'Привет! 🥁';
  }
  if (/(спасиб|благодар|спс)/.test(lower)) {
    return 'Обращайся! 🥁';
  }
  return 'Привет! 🥁';
};