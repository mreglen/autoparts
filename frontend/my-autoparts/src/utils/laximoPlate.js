/** Mirror backend plate.py — RU plate normalize / detect. */

const LATIN_TO_CYR = {
  A: 'А',
  B: 'В',
  E: 'Е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  Y: 'У',
  X: 'Х',
};

const ALLOWED = new Set('АВЕКМНОРСТУХ0123456789'.split(''));

export function normalizePlate(value) {
  if (value == null) return '';
  let text = String(value).trim().toUpperCase();
  text = text.replace(/[\s\-–—]+/g, '');
  text = text.replace(/[ABEKMHOPCTYX]/g, (ch) => LATIN_TO_CYR[ch] || ch);
  return text;
}

export function looksLikeRuPlate(value) {
  const norm = normalizePlate(value);
  if (norm.length < 6 || norm.length > 12) return false;
  return [...norm].every((ch) => ALLOWED.has(ch));
}

export function formatPlateInput(value) {
  const raw = String(value || '');
  return raw.toUpperCase().replace(/\s+/g, ' ').trimStart();
}
