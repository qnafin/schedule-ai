import type OpenAI from 'openai';

/**
 * Достаёт текстовые части из message-элементов response.
 * Игнорирует reasoning и mcp_call.
 */
export const extractText = (response: OpenAI.Responses.Response): string => {
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const chunk of item.content ?? []) {
      if (chunk.type === 'output_text') parts.push(chunk.text);
    }
  }
  return parts.join('\n').trim() || response.output_text || '';
};

/**
 * Ищет mcp_call по имени в output.
 * Возвращает сырой item — парсинг arguments на стороне вызывающего.
 */
export const findMcpCall = (
  response: OpenAI.Responses.Response,
  name: string,
): Record<string, unknown> | null => {
  for (const item of response.output ?? []) {
    if (item.type !== 'mcp_call') continue;
    if (item.name !== name) continue;
    return item as unknown as Record<string, unknown>;
  }
  return null;
};

/**
 * Логирует все MCP-вызовы из response — для отладки.
 */
export const logMcpCalls = (response: OpenAI.Responses.Response): void => {
  for (const item of response.output ?? []) {
    if (item.type !== 'mcp_call') continue;
    const err = 'error' in item ? item.error : undefined;
    console.log(`[MCP] ${item.server_label}/${item.name}${err ? ` — ${err}` : ''}`);
  }
};