import type OpenAI from 'openai';
import { findMcpCall } from '../shared';

export type HandoffResult = { reason?: string };

/**
 * Если в response был вызван handoff_to_router — вернёт { reason }.
 * Иначе null.
 */
export const detectHandoff = (
  response: OpenAI.Responses.Response,
): HandoffResult | null => {
  const call = findMcpCall(response, 'handoff_to_router');
  if (!call) return null;

  let reason: string | undefined;
  try {
    const args = call.arguments;
    const parsed = typeof args === 'string' ? JSON.parse(args) : args;
    reason = (parsed as { reason?: string } | undefined)?.reason;
  } catch {
    // arguments могут быть невалидным JSON — игнорируем
  }

  return { reason };
};