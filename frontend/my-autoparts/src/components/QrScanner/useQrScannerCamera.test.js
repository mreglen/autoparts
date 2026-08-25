import {
  HAPTIC_SCAN_ERROR,
  HAPTIC_SCAN_SUCCESS,
  stopScannerSafe,
  triggerScanErrorHaptic,
  triggerScanSuccessHaptic,
} from './useQrScannerCamera';

describe('useQrScannerCamera helpers', () => {
  it('exports stopScannerSafe as async function', () => {
    expect(typeof stopScannerSafe).toBe('function');
    expect(stopScannerSafe(null)).resolves.toBeUndefined();
  });

  it('exports haptic patterns and triggers', () => {
    expect(HAPTIC_SCAN_SUCCESS).toBe(20);
    expect(Array.isArray(HAPTIC_SCAN_ERROR)).toBe(true);
    expect(typeof triggerScanSuccessHaptic()).toBe('boolean');
    expect(typeof triggerScanErrorHaptic()).toBe('boolean');
  });
});
