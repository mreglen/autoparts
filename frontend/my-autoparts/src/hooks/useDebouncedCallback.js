import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Returns a stable debounced wrapper around `callback`.
 * Pending timers are cleared on unmount.
 */
export function useDebouncedCallback(callback, delayMs = 350) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return useCallback((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delayMs);
  }, [delayMs]);
}

/** Value that lags behind `value` by `delayMs` — keeps typing snappy without remounting inputs. */
export function useDebouncedValue(value, delayMs = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
