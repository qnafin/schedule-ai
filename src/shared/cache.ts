export type Cache<T> = {
  /** Значение из кэша или undefined, если пусто/протухло */
  get(): T | undefined;

  /** Положить значение (перезаписывает существующее) */
  set(value: T): void;

  /** Есть ли живое значение */
  has(): boolean;

  /** Сбросить кэш. Следующий getOrLoad пойдёт за данными заново */
  invalidate(): void;

  /**
   * Вернуть значение из кэша, иначе вызвать loader, сохранить и вернуть.
   * Параллельные вызовы разделяют один и тот же loader (dedup).
   */
  getOrLoad(loader: () => Promise<T>): Promise<T>;
};

export const createCache = <T>(ttlMs: number): Cache<T> => {
  let entry: { value: T; expiresAt: number } | null = null;
  let inflight: Promise<T> | null = null;
  let generation = 0;

  const isFresh = () => entry !== null && entry.expiresAt > Date.now();

  return {
    get: () => (isFresh() ? entry!.value : undefined),

    set: (value) => {
      entry = { value, expiresAt: Date.now() + ttlMs };
    },

    has: isFresh,

    invalidate: () => {
      entry = null;
      inflight = null;
      generation += 1;
    },

    getOrLoad: (loader) => {
      if (isFresh()) return Promise.resolve(entry!.value);
      if (inflight) return inflight;

      const myGen = generation;
      inflight = loader()
        .then((value) => {
          // Если между началом загрузки и её концом кто-то вызвал invalidate,
          // не затираем его намерение устаревшими данными
          if (myGen === generation) {
            entry = { value, expiresAt: Date.now() + ttlMs };
          }
          return value;
        })
        .finally(() => {
          if (myGen === generation) inflight = null;
        });

      return inflight;
    },
  };
};