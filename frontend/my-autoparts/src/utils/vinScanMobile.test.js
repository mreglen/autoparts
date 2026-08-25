import {
  getCameraVideoConstraints,
  getVinOcrProfile,
  getVinScanTiming,
  isMobileVinScanDevice,
  liveScanStatusLabel,
} from './vinScanMobile';

function mockMatchMedia(queries) {
  window.matchMedia = jest.fn((query) => ({
    matches: Boolean(queries[query]),
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
}

describe('vinScanMobile', () => {
  const originalTouchPoints = navigator.maxTouchPoints;

  afterEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: originalTouchPoints,
    });
    delete window.matchMedia;
  });

  it('detects mobile via coarse pointer or narrow viewport', () => {
    mockMatchMedia({ '(pointer: coarse)': true });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    expect(isMobileVinScanDevice()).toBe(true);

    mockMatchMedia({ '(max-width: 768px)': true });
    expect(isMobileVinScanDevice()).toBe(true);
  });

  it('detects desktop when no mobile signals', () => {
    mockMatchMedia({});
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    expect(isMobileVinScanDevice()).toBe(false);
  });

  it('returns slower live interval on mobile', () => {
    mockMatchMedia({ '(pointer: coarse)': true });
    expect(getVinScanTiming()).toEqual({ liveIntervalMs: 1500, barcodeEveryNTicks: 2 });

    mockMatchMedia({});
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    expect(getVinScanTiming()).toEqual({ liveIntervalMs: 600, barcodeEveryNTicks: 1 });
  });

  it('returns 720p camera constraints on mobile', () => {
    mockMatchMedia({ '(pointer: coarse)': true });
    expect(getCameraVideoConstraints()).toEqual({
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    });

    mockMatchMedia({});
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    expect(getCameraVideoConstraints()).toEqual({
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    });
  });

  it('returns lighter OCR profile for live on mobile', () => {
    mockMatchMedia({ '(pointer: coarse)': true });
    const live = getVinOcrProfile('live');
    expect(live.maxPasses).toBe(1);
    expect(live.allowBinarize).toBe(false);
    expect(live.minTargetWidth).toBe(720);

    const manual = getVinOcrProfile('manual');
    expect(manual.maxPasses).toBe(3);
    expect(manual.allowBinarize).toBe(true);

    const photo = getVinOcrProfile('photo');
    expect(photo.maxPhotoBands).toBe(3);
  });

  it('returns desktop OCR profiles with more passes', () => {
    mockMatchMedia({});
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    expect(getVinOcrProfile('live').maxPasses).toBe(2);
    expect(getVinOcrProfile('photo').maxPhotoBands).toBe(5);
  });

  it('formats mobile live status labels', () => {
    expect(liveScanStatusLabel({ engineReady: false, mobile: true })).toContain('Готовим');
    expect(liveScanStatusLabel({ engineReady: true, processing: true, mobile: true })).toContain('~2 сек');
    expect(liveScanStatusLabel({ engineReady: true, scanProgress: 0.2, mobile: true })).toContain('~2 сек');
  });
});
