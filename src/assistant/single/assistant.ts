import type OpenAI from 'openai';
import { renderContextLine, type SenderContext } from '../shared/context';
import { extractText, logMcpCalls } from '../shared/responses';

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
    logMcpCalls(response);
    return extractText(response);
  }

  resetSession(sessionId: string): void {
    this.previousResponseIds.delete(sessionId);
  }
}