import { looksLikeRuPlate } from './laximoPlate';
import { looksLikeVin, sanitizeVinInput } from './laximoVin';

/** Detect whether lookup input is VIN, RU plate, or Frame (JP body code). */
export function detectVehicleLookupKind(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (looksLikeVin(raw)) return 'vin';
  if (looksLikeRuPlate(raw)) return 'plate';

  const compact = raw.toUpperCase().replace(/\s+/g, '');
  if (compact.includes('-') && compact.length >= 6) return 'frame';
  if (compact.length >= 6 && /^[A-Z0-9-]+$/.test(compact)) return 'frame';
  return null;
}

export function formatVehicleLookupInput(value) {
  const raw = String(value || '');
  if (looksLikeVin(raw)) return sanitizeVinInput(raw);
  if (looksLikeRuPlate(raw)) {
    return raw.toUpperCase().replace(/\s+/g, ' ').trimStart();
  }
  return raw.toUpperCase().replace(/\s+/g, '').trimStart();
}
