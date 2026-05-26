import { apiAxiosUnauth } from './apiClient';

/**
 * Подсказки адреса через backend-прокси DaData.
 * @param {string} query
 * @param {{ count?: number, locations?: Array<Record<string, string>> }} options
 * @returns {Promise<{ suggestions: Array, error: string | null }>}
 */
export async function fetchAddressSuggestions(query, options = {}) {
  const { count = 7, locations } = options;
  try {
    const response = await apiAxiosUnauth.post('/public/dadata/suggest/address', {
      query,
      count,
      locations: locations?.length ? locations : undefined,
    });
    const suggestions = Array.isArray(response.data?.suggestions)
      ? response.data.suggestions
      : [];
    return { suggestions, error: null };
  } catch (err) {
    const detail = err?.response?.data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : 'Не удалось загрузить подсказки адреса';
    return { suggestions: [], error: message };
  }
}
