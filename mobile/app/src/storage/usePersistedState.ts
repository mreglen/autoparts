import { useCallback, useEffect, useState } from 'react';

import { readJson, writeJson } from './kv';

export type Setter<T> = (next: T | ((previous: T) => T)) => void;

/** Значение живёт в памяти и переживает перезапуск: мобильный аналог `usePersistedPageFilters`. */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    let alive = true;
    void readJson<T>(key, initial).then((stored) => {
      if (alive) setValue(stored);
    });
    return () => {
      alive = false;
    };
    // initial — константа вызова, а не реагирующее значение.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback<Setter<T>>(
    (next) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(previous) : next;
        void writeJson(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}
