import { extractVinFromBarcodeRawValue } from './vinBarcodeScan';

describe('vinBarcodeScan', () => {
  it('extracts VIN from barcode payload with spaces', () => {
    expect(extractVinFromBarcodeRawValue('JHMGD18908S212467')).toBe('JHMGD18908S212467');
    expect(extractVinFromBarcodeRawValue('VIN JHMGD18908S212467')).toBe('JHMGD18908S212467');
  });

  it('returns null for invalid payload', () => {
    expect(extractVinFromBarcodeRawValue('123')).toBeNull();
  });
});
