/** Mirror backend vin.py rules for client-side VIN detect. */

const VIN_FORBIDDEN = /[IOQ]/;

export function looksLikeVin(value) {
  if (value == null) return false;
  const norm = String(value).trim().toUpperCase();
  if (norm.length !== 17) return false;
  if (VIN_FORBIDDEN.test(norm)) return false;
  if (!/^[A-Z0-9]+$/.test(norm)) return false;
  if (!/[A-Z]/.test(norm)) return false;
  return true;
}

export function normalizeVinOrNull(value) {
  if (!looksLikeVin(value)) return null;
  return String(value).trim().toUpperCase();
}
