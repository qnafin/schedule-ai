export interface McpServer {
  type: 'mcp';
  server_label: string;
  server_url: string;
  require_approval: 'never';
  headers?: Record<string, string>;
}

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