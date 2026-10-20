import type OpenAI from 'openai';
import { buildModelUri, extractText } from '../shared';
import { ROUTER_PROMPT, type AgentRole } from './config';

export type ClassifyResult = AgentRole | 'SMALLTALK';

export interface RouterOptions {
  client: OpenAI;
  folderId: string;
  model: string;
}

export const classify = async (
  opts: RouterOptions,
  input: string,
): Promise<ClassifyResult> => {
  const response = await opts.client.responses.create({
    model: buildModelUri(opts.folderId, opts.model),
    store: false,
    reasoning: { effort: 'low' },
    instructions: ROUTER_PROMPT,
    input,
  });

  const text = extractText(response).toUpperCase();
  if (text.includes('SMALLTALK')) return 'SMALLTALK';
  if (text.includes('SCHEDULE')) return 'SCHEDULE';
  if (text.includes('KNOWLEDGE')) return 'KNOWLEDGE';
  if (text.includes('SALES')) return 'SALES';
  return 'SUPPORT';
};