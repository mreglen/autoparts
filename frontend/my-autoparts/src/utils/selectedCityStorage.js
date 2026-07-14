import { DEFAULT_CITY } from './organizationCity';

export const SELECTED_CITY_STORAGE_KEY = 'sg_selected_city';
export const CITY_CHANGED_EVENT = 'sg:city-changed';

export function getSelectedCity() {
  try {
    const value = String(localStorage.getItem(SELECTED_CITY_STORAGE_KEY) || '')
      .replace(/\s+/g, ' ')
      .trim();
    return value || DEFAULT_CITY;
  } catch {
    return DEFAULT_CITY;
  }
}

export function setSelectedCity(city) {
  const normalized = String(city || '')
    .replace(/\s+/g, ' ')
    .trim() || DEFAULT_CITY;
  try {
    localStorage.setItem(SELECTED_CITY_STORAGE_KEY, normalized);
  } catch {
    // ignore quota / private mode
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CITY_CHANGED_EVENT, { detail: { city: normalized } })
    );
  }
  return normalized;
}
