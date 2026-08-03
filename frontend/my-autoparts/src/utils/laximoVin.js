/** Mirror backend vin.py rules for client-side VIN detect. */

export const VIN_MIN_LENGTH = 11;
export const VIN_MAX_LENGTH = 17;

const VIN_FORBIDDEN = /[IOQ]/;

export function looksLikeVin(value) {
  if (value == null) return false;
  const norm = String(value).trim().toUpperCase();
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH) return false;
  if (VIN_FORBIDDEN.test(norm)) return false;
  if (!/^[A-Z0-9]+$/.test(norm)) return false;
  if (!/[A-Z]/.test(norm)) return false;
  return true;
}

export function normalizeVinOrNull(value) {
  if (!looksLikeVin(value)) return null;
  return String(value).trim().toUpperCase();
}
