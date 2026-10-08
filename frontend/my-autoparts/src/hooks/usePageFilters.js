import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  const [filters, setFiltersState] = useState(defaultFilters);
  const didReadFromUrl = useRef(false);

  useEffect(() => {
    if (!syncWithUrl || didReadFromUrl.current) return;
    didReadFromUrl.current = true;
    const next = { ...defaultFilters };
    Object.keys(defaultFilters).forEach((key) => {
      const value = searchParams.get(prefixed(key));
      if (value !== null) {
        next[key] = value;
      }
    });
    setFiltersState(next);
  }, [syncWithUrl, defaultFilters, searchParams, prefixed]);

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
    const params = new URLSearchParams(window.location.search);
    Object.entries(filters).forEach(([key, value]) => {
      const paramKey = prefixed(key);
      const defaultValue = defaultFilters[key];
      if (value !== undefined && value !== '' && value !== null && !valuesEqual(value, defaultValue)) {
        params.set(paramKey, String(value));
      } else {
        params.delete(paramKey);
      }
    });
    const nextSearch = params.toString();
    const currentSearch = window.location.search.slice(1);
    if (nextSearch !== currentSearch) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, syncWithUrl, setSearchParams, prefixed, defaultFilters]);

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
