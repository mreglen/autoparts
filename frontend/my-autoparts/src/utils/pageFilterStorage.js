import { useEffect } from 'react';

const NAMESPACE = 'sgPageFilters:';

function setRaw(key, serialized) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NAMESPACE + key, serialized);
  } catch {
    // квота переполнена: фильтры просто не запомнятся
  }
}

export function readPageFilters(key) {
  if (!key || typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(NAMESPACE + key) || 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function usePersistedPageFilters(key, values) {
  const serialized = JSON.stringify(values);

  useEffect(() => {
    setRaw(key, serialized);
  }, [key, serialized]);
}
