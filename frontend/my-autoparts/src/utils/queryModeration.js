import { looksLikeVin, normalizeVinForSearchOrNull, normalizeVinOrNull } from './laximoVin';

const PROFANITY_ROOTS = [
  'бляд',
  'блят',
  'бля',
  'хуй',
  'хуя',
  'хуе',
  'хуи',
  'хую',
  'пизд',
  'пезд',
  'ебан',
  'ебат',
  'ебл',
  'ебал',
  'ебуч',
  'ёб',
  'сука',
  'сучк',
  'мудак',
  'мудил',
  'пидор',
  'пидар',
  'педик',
  'говн',
  'залуп',
  'дроч',
  'fuck',
  'shit',
  'bitch',
];

function compactText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '');
}

function containsProfanity(value) {
  const text = String(value || '').trim();
  if (!text) return false;

  const compactFull = compactText(text);
  if (compactFull && PROFANITY_ROOTS.some((root) => compactFull.includes(root))) {
    return true;
  }

  return text
    .split(/[\s,;/]+/)
    .some((token) => {
      const compactToken = compactText(token);
      return compactToken && PROFANITY_ROOTS.some((root) => compactToken.includes(root));
    });
}

function queryContainsVin(value) {
  const text = String(value || '').trim();
  if (!text) return false;

  if (normalizeVinForSearchOrNull(text)) return true;

  const tokens = text.split(/[\s,;/]+/).map((token) => token.trim()).filter(Boolean);
  if (tokens.length <= 1) return false;

  return tokens.some((token) => normalizeVinOrNull(token));
}

export function isAllowedPopularQuery(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (queryContainsVin(text)) return false;
  if (containsProfanity(text)) return false;
  return true;
}

export { looksLikeVin, queryContainsVin };
