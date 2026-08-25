import { VIN_MAX_LENGTH } from './laximoVin';

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const VIN_TRANSLITERATION = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
};

function transliterateChar(ch) {
  return VIN_TRANSLITERATION[String(ch || '').toUpperCase()] ?? null;
}

export function computeVinCheckDigit(vin) {
  const text = String(vin || '').toUpperCase();
  if (text.length !== VIN_MAX_LENGTH) return null;

  let sum = 0;
  for (let i = 0; i < VIN_MAX_LENGTH; i += 1) {
    if (i === 8) continue;
    const value = transliterateChar(text[i]);
    if (value == null) return null;
    sum += value * VIN_WEIGHTS[i];
  }

  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/**
 * @returns {true|false|null} true/false when check digit can be verified, null when not applicable
 */
export function vinCheckDigitValid(vin) {
  const text = String(vin || '').toUpperCase();
  if (text.length !== VIN_MAX_LENGTH) return null;

  for (const ch of text) {
    if (transliterateChar(ch) == null) return null;
  }

  const expected = computeVinCheckDigit(text);
  if (expected == null) return null;
  return text[8] === expected;
}

export function vinCheckDigitScoreBoost(vin) {
  const result = vinCheckDigitValid(vin);
  if (result === true) return 25;
  if (result === false) return -8;
  return 0;
}
