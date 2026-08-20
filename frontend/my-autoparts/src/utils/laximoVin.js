/** Mirror backend vin.py rules for client-side VIN detect. */

export const VIN_MIN_LENGTH = 11;
export const VIN_MAX_LENGTH = 17;
/** Allow paste with spaces/dashes; sanitizeVinInput then slices to VIN_MAX_LENGTH. */
export const VIN_INPUT_MAX_LENGTH = 32;

const VIN_FORBIDDEN = /[IOQ]/;
const VIN_ALLOWED = /^[A-HJ-NPR-Z0-9]+$/;
const RELAXED_VIN_ALLOWED = /^[A-Z0-9]+$/;
const SHORT_VIN_MAX_DIGIT_RATIO = 0.65;
const SHORT_VIN_MIN_LETTERS = 3;
const FULL_VIN_MIN_LETTERS = 3;
const TOKEN_SPLIT_RE = /[\s,;/]+/;
const VIN_FRAGMENT_RE = /^[A-Za-z0-9]{1,8}$/;

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

function letterAndDigitStats(norm) {
  let letters = 0;
  let digits = 0;
  for (const ch of norm) {
    if (ch >= 'A' && ch <= 'Z') letters += 1;
    else if (ch >= '0' && ch <= '9') digits += 1;
  }
  return { letters, digits };
}

function looksLikePartNumber(norm) {
  const length = norm.length;
  if (length < VIN_MIN_LENGTH) return true;

  const { letters, digits } = letterAndDigitStats(norm);
  if (letters < FULL_VIN_MIN_LETTERS) return true;

  if (length < VIN_MAX_LENGTH) {
    if (letters < SHORT_VIN_MIN_LETTERS) return true;
    const total = letters + digits;
    if (total > 0 && digits / total >= SHORT_VIN_MAX_DIGIT_RATIO) return true;
  }

  return false;
}

function tokenLooksLikeBrandWord(token) {
  return token.length >= 4 && /^[A-Za-z]+$/.test(token);
}

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
  if (looksLikePartNumber(norm)) return false;
  return true;
}

function rewriteCommonVinOcrConfusions(norm) {
  return norm.replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
}

function looksLikeRelaxedChassis(norm) {
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH) return false;
  if (!RELAXED_VIN_ALLOWED.test(norm)) return false;
  if (!/[A-Z]/.test(norm)) return false;
  if (looksLikePartNumber(norm)) return false;
  return true;
}

/** Garage storage: ISO VIN, OCR fixes (I→1, O/Q→0), or relaxed chassis numbers. */
function resolveVinForLookup(norm) {
  for (const candidate of [norm, rewriteCommonVinOcrConfusions(norm)]) {
    if (looksLikeVin(candidate)) return candidate;
  }
  return null;
}

/** Laximo/search: strict ISO VIN, with I→1 / O,Q→0 OCR fixes. */
export function normalizeVinForLookupOrNull(value) {
  const norm = sanitizeVinInput(value);
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH) return null;
  return resolveVinForLookup(norm);
}

export function normalizeGarageVinOrNull(value) {
  const norm = sanitizeVinInput(value);
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH) return null;

  const resolved = resolveVinForLookup(norm);
  if (resolved) return resolved;
  if (looksLikeRelaxedChassis(norm)) return norm;
  return null;
}

export function normalizeVinOrNull(value) {
  if (!looksLikeVin(value)) return null;
  return sanitizeVinInput(value);
}

/**
 * VIN detection for global search — skips brand+article and part-number false positives.
 */
export function normalizeVinForSearchOrNull(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const tokens = text.split(TOKEN_SPLIT_RE).map((token) => token.trim()).filter(Boolean);
  if (tokens.length > 1) {
    if (tokens.some(tokenLooksLikeBrandWord)) return null;
    const joined = tokens.join('');
    if (!tokens.every((token) => VIN_FRAGMENT_RE.test(token))) return null;
    return normalizeVinForLookupOrNull(joined);
  }

  if (/[/\\._]/.test(text)) return null;

  return normalizeVinForLookupOrNull(text);
}

export function queryLooksLikeVin(value) {
  return normalizeVinForSearchOrNull(value) != null;
}
