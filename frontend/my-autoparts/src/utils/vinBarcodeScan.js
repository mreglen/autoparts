import { normalizeVinOrNull, sanitizeVinInput } from './laximoVin';
import { extractVinFromOcrText } from './extractVinFromOcrText';

const VIN_BARCODE_FORMATS = ['code_39', 'code_128', 'data_matrix'];

export function createVinBarcodeDetector() {
  if (typeof window === 'undefined' || typeof window.BarcodeDetector !== 'function') {
    return null;
  }
  try {
    return new window.BarcodeDetector({ formats: VIN_BARCODE_FORMATS });
  } catch (_) {
    return null;
  }
}

export function isVinBarcodeScanSupported() {
  return createVinBarcodeDetector() != null;
}

export function extractVinFromBarcodeRawValue(rawValue) {
  const fromText = extractVinFromOcrText(String(rawValue || ''));
  if (fromText?.normalized) return fromText.normalized;

  const compact = sanitizeVinInput(String(rawValue || '').replace(/[^A-Za-z0-9]/g, ''));
  return normalizeVinOrNull(compact);
}

export async function scanVinBarcodeFromSource(detector, source) {
  if (!detector || !source) return null;
  try {
    const barcodes = await detector.detect(source);
    for (const barcode of barcodes || []) {
      const vin = extractVinFromBarcodeRawValue(barcode?.rawValue);
      if (vin) return vin;
    }
  } catch (_) {
    /* unsupported or transient */
  }
  return null;
}
