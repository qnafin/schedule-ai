export interface DebouncerOptions<TContext> {
  quietMs?: number;
  maxWaitMs?: number;
  onFlush: (sessionId: string, texts: string[], context: TContext) => Promise<void>;
}

export const createDebouncer = <TContext>({
  quietMs = 1000,
  maxWaitMs = 15000,
  onFlush,
}: DebouncerOptions<TContext>) => {
  const buffers = new Map<string, { texts: string[]; context: TContext }>();
  const quietTimers = new Map<string, NodeJS.Timeout>();
  const maxTimers = new Map<string, NodeJS.Timeout>();

  const clearTimers = (sessionId: string): void => {
    const q = quietTimers.get(sessionId);
    if (q) clearTimeout(q);
    const m = maxTimers.get(sessionId);
    if (m) clearTimeout(m);
    quietTimers.delete(sessionId);
    maxTimers.delete(sessionId);
  };

  const flush = async (sessionId: string): Promise<void> => {
    const buf = buffers.get(sessionId);
    if (!buf?.texts.length) return;

    buffers.delete(sessionId);
    clearTimers(sessionId);

    try {
      await onFlush(sessionId, buf.texts, buf.context);
    } catch (e) {
      console.error(`[debouncer] flush failed for ${sessionId}:`, e);
    }
  };

  const push = (sessionId: string, text: string, context: TContext): void => {
    const existing = buffers.get(sessionId);
    if (existing) {
      existing.texts.push(text);
      existing.context = context; // последний контекст перекрывает предыдущий
    } else {
      buffers.set(sessionId, { texts: [text], context });
    }

    const q = quietTimers.get(sessionId);
    if (q) clearTimeout(q);
    quietTimers.set(sessionId, setTimeout(() => void flush(sessionId), quietMs));

    if (!maxTimers.has(sessionId)) {
      maxTimers.set(sessionId, setTimeout(() => void flush(sessionId), maxWaitMs));
    }
  };

  const flushNow = (sessionId: string): Promise<void> => flush(sessionId);

  return { push, flushNow };
};