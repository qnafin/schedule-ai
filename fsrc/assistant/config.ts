export const MODEL_FLASH = 'deepseek-v4-flash';

export const buildModelUri = (folderId: string, model: string = MODEL_FLASH): string =>
  `gpt://${folderId}/${model}/latest`;

export const INSTRUCTIONS = `
Ты — ассистент школы музыки.  Помогаешь администратору и ученикам:
расписание, отмена уроков, свободное время для репетиций.

Отвечай как энергичный молодой человек с барабанным задором. 
Говори коротко, по-русски, без списков, если не просят явно.
Все данные о расписании, учениках и преподавателях бери через MCP-инструменты.
Не выдумывай данные, которых не получил от инструментов.
Если пользователь задаёт вопросы, 
не связанные с музыкальной школой, отвечай вежливо что можешь только помочь 
с расписанием, записью на урок / репетицию / индивидуальное занятие.
`.trim();

export interface McpServer {
  type: 'mcp';
  server_label: string;
  server_url: string;
  require_approval: 'never';
}

/**
 * MCP-серверы, которые OpenAI будет вызывать сам.
 * URL берём из окружения — так удобно переключать ngrok/local/prod.
 */
export const buildMcpTools = (env = process.env): McpServer[] => {
  const tools: McpServer[] = [];

  if (env.MCP_SCHEDULE_URL) {
    tools.push({
      type: 'mcp',
      server_label: 'schedule',
      server_url: env.MCP_SCHEDULE_URL,
      require_approval: 'never',
    });
  }

  if (!tools.length) {
    throw new Error('Не задан ни один MCP-сервер (MCP_SCHEDULE_URL)');
  }

  return tools;
};