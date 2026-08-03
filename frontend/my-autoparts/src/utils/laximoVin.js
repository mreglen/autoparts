/** Mirror backend vin.py rules for client-side VIN detect. */

export const VIN_MIN_LENGTH = 11;
export const VIN_MAX_LENGTH = 17;
/** Allow paste with spaces/dashes; sanitizeVinInput then slices to VIN_MAX_LENGTH. */
export const VIN_INPUT_MAX_LENGTH = 32;

const VIN_FORBIDDEN = /[IOQ]/;
const VIN_ALLOWED = /^[A-HJ-NPR-Z0-9]+$/;

/** Cyrillic lookalikes (RU keyboard) → Latin VIN letters */
const CYR_TO_LATIN = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

/**
 * Uppercase, strip spaces/dashes/etc., map Cyrillic lookalikes.
 * No length validation — use for controlled inputs and before looksLikeVin.
 */
export function sanitizeVinInput(value) {
  if (value == null) return '';
  let text = String(value).trim().toUpperCase();
  text = text.replace(/[АВЕКМНОРСТУХ]/g, (ch) => CYR_TO_LATIN[ch] || ch);
  text = text.replace(/[\s\-–—_./\\]+/g, '');
  return text.slice(0, VIN_MAX_LENGTH);
}

export function looksLikeVin(value) {
  const norm = sanitizeVinInput(value);
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH) return false;
  if (VIN_FORBIDDEN.test(norm)) return false;
  if (!VIN_ALLOWED.test(norm)) return false;
  if (!/[A-Z]/.test(norm)) return false;
  return true;
}

export function normalizeVinOrNull(value) {
  if (!looksLikeVin(value)) return null;
  return sanitizeVinInput(value);
}
