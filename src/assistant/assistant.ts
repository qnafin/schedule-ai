import type OpenAI from 'openai';
import { renderContextLine, type SenderContext } from './context';

export type { SenderContext };

export interface AssistantOptions {
  client: OpenAI;
  model: string;
  instructions: string;
  tools: any[];
}

export class Assistant {
  private readonly previousResponseIds = new Map<string, string>();

  constructor(private readonly opts: AssistantOptions) {}

  async ask(
    userInput: string,
    sessionId = 'default',
    context?: SenderContext,
  ): Promise<string> {
    const contextLine = renderContextLine(context);
    const input = contextLine ? `${contextLine}\n${userInput}` : userInput;

    const response = await this.opts.client.responses.create({
      model: this.opts.model,
      store: true,
      reasoning: { effort: 'low' },
      previous_response_id: this.previousResponseIds.get(sessionId),
      instructions: this.opts.instructions,
      input,
      tools: this.opts.tools,
      tool_choice: 'auto',
    });

    this.previousResponseIds.set(sessionId, response.id);
    this.logMcpCalls(response);
    return this.extractText(response);
  }

  resetSession(sessionId: string): void {
    this.previousResponseIds.delete(sessionId);
  }

  private logMcpCalls(response: OpenAI.Responses.Response): void {
    for (const item of response.output ?? []) {
      if (item.type !== 'mcp_call') continue;
      const err = 'error' in item ? item.error : undefined;
      console.log(`[MCP] ${item.server_label}/${item.name}${err ? ` — ${err}` : ''}`);
    }
  }

  private extractText(response: OpenAI.Responses.Response): string {
    const parts: string[] = [];
    for (const item of response.output ?? []) {
      if (item.type !== 'message') continue;
      for (const chunk of item.content ?? []) {
        if (chunk.type === 'output_text') parts.push(chunk.text);
      }
    }
    return parts.join('\n').trim() || response.output_text || '';
  }
}