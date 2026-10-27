import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readPageFilters, usePersistedPageFilters } from '../utils/pageFilterStorage';

function valuesEqual(a, b) {
  return String(a ?? '') === String(b ?? '');
}

function hydrateFromStorage(defaultFilters, storageKey) {
  const stored = readPageFilters(storageKey);
  const next = { ...defaultFilters };
  Object.keys(defaultFilters).forEach((key) => {
    if (stored[key] !== undefined) next[key] = stored[key];
  });
  return next;
}

export function usePageFilters(
  defaultFilters,
  { syncWithUrl = false, prefix = '', storageKey = '' } = {},
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const prefixed = useCallback(
    (key) => (prefix ? `${prefix}_${key}` : key),
    [prefix],
  );

  const [filters, setFiltersState] = useState(() => hydrateFromStorage(defaultFilters, storageKey));
  const didReadFromUrl = useRef(false);

  usePersistedPageFilters(storageKey, filters);

  useEffect(() => {
    if (!syncWithUrl || didReadFromUrl.current) return;
    didReadFromUrl.current = true;
    setFiltersState((prev) => {
      const next = { ...prev };
      Object.keys(defaultFilters).forEach((key) => {
        const value = searchParams.get(prefixed(key));
        if (value !== null) {
          next[key] = value;
        }
      });
      return next;
    });
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
