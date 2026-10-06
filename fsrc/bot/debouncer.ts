export interface DebouncerOptions {
  /** Пауза после последнего сообщения, мс */
  quietMs?: number;
  /** Максимум ожидания с первого сообщения, мс (защита от «флудера») */
  maxWaitMs?: number;
  /** Что делать с накопленными сообщениями */
  onFlush: (sessionId: string, texts: string[]) => Promise<void>;
}

export const createDebouncer = ({
  quietMs = 500,
  maxWaitMs = 15000,
  onFlush,
}: DebouncerOptions) => {
  const buffers = new Map<string, string[]>();
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
    const texts = buffers.get(sessionId);
    if (!texts?.length) return;

    buffers.delete(sessionId);
    clearTimers(sessionId);

    try {
      await onFlush(sessionId, texts);
    } catch (e) {
      console.error(`[debouncer] flush failed for ${sessionId}:`, e);
    }
  };

  const push = (sessionId: string, text: string): void => {
    const buffer = buffers.get(sessionId) ?? [];
    buffer.push(text);
    buffers.set(sessionId, buffer);

    // Сбрасываем «тихий» таймер — ждём паузу после последнего сообщения
    const q = quietTimers.get(sessionId);
    if (q) clearTimeout(q);
    quietTimers.set(
      sessionId,
      setTimeout(() => void flush(sessionId), quietMs)
    );

    // Первый раз — ставим «жёсткий» таймер, чтобы болтун не копил вечно
    if (!maxTimers.has(sessionId)) {
      maxTimers.set(
        sessionId,
        setTimeout(() => void flush(sessionId), maxWaitMs)
      );
    }
  };

  const flushNow = (sessionId: string): Promise<void> => flush(sessionId);

  return { push, flushNow };
};