import { apiAxiosUnauth } from '../../../utils/apiClient';
import { QUICK_SEARCH_CHIPS } from './rosskoHelpers';

const FALLBACK_LIMIT = 8;

function normalizeQueries(items) {
  const seen = new Set();
  const normalized = [];
  (items || []).forEach((item) => {
    const value = String(item || '').replace(/\s+/g, ' ').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(value);
  });
  return normalized;
}

export function getDefaultPopularNewPartQueries(limit = FALLBACK_LIMIT) {
  return normalizeQueries(QUICK_SEARCH_CHIPS).slice(0, limit);
}

export async function fetchPopularNewPartQueries(limit = FALLBACK_LIMIT) {
  const fallback = getDefaultPopularNewPartQueries(limit);
  try {
    const response = await apiAxiosUnauth.get('/public/autoparts/new/popular-queries', {
      params: { limit },
    });
    const fromApi = normalizeQueries(response?.data?.items || []);
    if (!fromApi.length) return fallback;
    if (fromApi.length >= limit) return fromApi.slice(0, limit);
    return normalizeQueries([...fromApi, ...fallback]).slice(0, limit);
  } catch (_e) {
    return fallback;
  }
}
