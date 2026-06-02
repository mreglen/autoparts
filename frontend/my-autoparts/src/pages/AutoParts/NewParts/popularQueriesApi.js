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

export async function fetchPopularNewPartQueries(limit = FALLBACK_LIMIT) {
  try {
    const response = await apiAxiosUnauth.get('/public/autoparts/new/popular-queries', {
      params: { limit },
    });
    const fromApi = normalizeQueries(response?.data?.items || []);
    if (fromApi.length > 0) return fromApi;
  } catch (_e) {
    // ignore and fallback to static chips
  }
  return normalizeQueries(QUICK_SEARCH_CHIPS).slice(0, limit);
}
