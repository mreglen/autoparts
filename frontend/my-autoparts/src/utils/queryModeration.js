import { looksLikeVin } from './laximoVin';

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

const VIN_FRAGMENT_RE = /^[A-Za-z0-9]{1,8}$/;

function tokenLooksLikeBrandWord(token) {
  return token.length >= 4 && /^[A-Za-z]+$/.test(token);
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

  const tokens = text.split(/[\s,;/]+/).map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) return false;

  if (tokens.length === 1) {
    return looksLikeVin(tokens[0]);
  }

  if (tokens.some((token) => looksLikeVin(token))) return true;

  const joined = tokens.join('');
  if (!looksLikeVin(joined)) return false;
  if (tokens.slice(0, -1).some((token) => tokenLooksLikeBrandWord(token))) return false;
  return tokens.every((token) => VIN_FRAGMENT_RE.test(token));
}

export function isAllowedPopularQuery(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (queryContainsVin(text)) return false;
  if (containsProfanity(text)) return false;
  return true;
}
