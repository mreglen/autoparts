const DADATA_SUGGEST_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

const DADATA_TOKEN =
  process.env.REACT_APP_DADATA_TOKEN || 'a1a8fbcf263bb8a2e549b1aa7fe56c08c1a2da1d';

/**
 * Подсказки адреса: город → улица → дом (без квартиры в подсказках).
 * @param {string} query
 * @param {{ count?: number, locations?: Array<Record<string, string>> }} options
 */
export async function fetchAddressSuggestions(query, options = {}) {
  const { count = 7, locations } = options;
  const body = {
    query,
    count,
    from_bound: { value: 'city' },
    to_bound: { value: 'house' },
  };
  if (locations?.length) {
    body.locations = locations;
  }

  const response = await fetch(DADATA_SUGGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Token ${DADATA_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}
