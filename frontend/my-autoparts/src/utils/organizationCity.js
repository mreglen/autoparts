export const DEFAULT_CITY = 'Екатеринбург';

const CITY_PREP = {
  екатеринбург: 'Екатеринбурге',
  москва: 'Москве',
  'санкт-петербург': 'Санкт-Петербурге',
  новосибирск: 'Новосибирске',
  казань: 'Казани',
  'нижний новгород': 'Нижнем Новгороде',
  челябинск: 'Челябинске',
  самара: 'Самаре',
  омск: 'Омске',
  'ростов-на-дону': 'Ростове-на-Дону',
  уфа: 'Уфе',
  красноярск: 'Красноярске',
  пермь: 'Перми',
  воронеж: 'Воронеже',
  волгоград: 'Волгограде',
};

export function extractCityFromAddress(address) {
  const value = String(address || '').replace(/\s+/g, ' ').trim();
  if (!value) return DEFAULT_CITY;

  const cityMatch = value.match(
    /(?:^|[,\s])(?:г\.?\s*|город\s+)([А-Яа-яЁё][А-Яа-яЁё\s\-]+?)(?=[,\s]|$)/i
  );
  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim().replace(/[,\s]+$/, '');
    if (city) return city.charAt(0).toUpperCase() + city.slice(1);
  }

  const afterIndex = value.match(
    /\b\d{6}\b[,\s]+(?:[А-Яа-яЁё\-]+\s+)?(?:обл\.|область|край|респ\.|республика)?[,\s]*([А-Яа-яЁё][А-Яа-яЁё\-]+)/i
  );
  if (afterIndex?.[1]) {
    const city = afterIndex[1].trim().replace(/[,\s]+$/, '');
    const lower = city.toLowerCase();
    if (city && !['обл', 'область', 'край', 'респ', 'республика'].includes(lower)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }

  return DEFAULT_CITY;
}

export function formatCityInPrepositional(city) {
  const normalized = String(city || '').replace(/\s+/g, ' ').trim() || DEFAULT_CITY;
  const key = normalized.toLowerCase();
  if (CITY_PREP[key]) return CITY_PREP[key];
  if (/[ая]$/.test(normalized)) return `${normalized.slice(0, -1)}е`;
  return normalized;
}
