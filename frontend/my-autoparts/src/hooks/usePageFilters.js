import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function valuesEqual(a, b) {
  return String(a ?? '') === String(b ?? '');
}

export function usePageFilters(defaultFilters, { syncWithUrl = false, prefix = '' } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const prefixed = useCallback(
    (key) => (prefix ? `${prefix}_${key}` : key),
    [prefix],
  );

  const initialFilters = useMemo(() => {
    const next = { ...defaultFilters };
    if (!syncWithUrl) return next;
    Object.keys(defaultFilters).forEach((key) => {
      const value = searchParams.get(prefixed(key));
      if (value !== null) {
        next[key] = value;
      }
    });
    return next;
  }, [defaultFilters, syncWithUrl, searchParams, prefixed]);

  const [filters, setFiltersState] = useState(initialFilters);

  const setFilters = useCallback((updater) => {
    setFiltersState((prev) => {
      const patch = typeof updater === 'function' ? updater(prev) : updater;
      return { ...prev, ...patch };
    });
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, [defaultFilters]);

  useEffect(() => {
    if (!syncWithUrl) return;
    const next = new URLSearchParams(searchParams);
    Object.entries(filters).forEach(([key, value]) => {
      const paramKey = prefixed(key);
      const defaultValue = defaultFilters[key];
      if (value !== undefined && value !== '' && value !== null && !valuesEqual(value, defaultValue)) {
        next.set(paramKey, String(value));
      } else {
        next.delete(paramKey);
      }
    });
    setSearchParams(next, { replace: true });
  }, [filters, syncWithUrl, searchParams, setSearchParams, prefixed, defaultFilters]);

  const activeKeys = useMemo(
    () => Object.keys(filters).filter((key) => !valuesEqual(filters[key], defaultFilters[key])),
    [filters, defaultFilters],
  );

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    activeKeys,
    activeCount: activeKeys.length,
  };
}
