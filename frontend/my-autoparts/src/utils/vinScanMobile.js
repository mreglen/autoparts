/** @typedef {'live' | 'manual' | 'photo'} VinOcrProfileName */

/**
 * @typedef {Object} VinOcrProfile
 * @property {number} minTargetWidth
 * @property {number} maxTargetWidth
 * @property {number} maxScale
 * @property {number} pad
 * @property {boolean} skipMoiré
 * @property {number} maxPasses
 * @property {boolean} allowBinarize
 * @property {boolean} allowPsmFallback
 * @property {number} [maxPhotoBands]
 * @property {number} [photoMaxSide]
 */

const MOBILE_LIVE = {
  minTargetWidth: 720,
  maxTargetWidth: 960,
  maxScale: 2.2,
  pad: 12,
  skipMoiré: true,
  maxPasses: 1,
  allowBinarize: false,
  allowPsmFallback: false,
};

const MOBILE_MANUAL = {
  minTargetWidth: 960,
  maxTargetWidth: 1200,
  maxScale: 2.4,
  pad: 18,
  skipMoiré: false,
  maxPasses: 3,
  allowBinarize: true,
  allowPsmFallback: true,
};

const MOBILE_PHOTO = {
  minTargetWidth: 960,
  maxTargetWidth: 1200,
  maxScale: 2.4,
  pad: 18,
  skipMoiré: false,
  maxPasses: 3,
  allowBinarize: true,
  allowPsmFallback: false,
  maxPhotoBands: 3,
  photoMaxSide: 1600,
};

const DESKTOP_LIVE = {
  minTargetWidth: 960,
  maxTargetWidth: 1400,
  maxScale: 2.6,
  pad: 18,
  skipMoiré: false,
  maxPasses: 2,
  allowBinarize: true,
  allowPsmFallback: false,
};

const DESKTOP_MANUAL = {
  minTargetWidth: 1200,
  maxTargetWidth: 1800,
  maxScale: 2.6,
  pad: 18,
  skipMoiré: false,
  maxPasses: 4,
  allowBinarize: true,
  allowPsmFallback: true,
};

const DESKTOP_PHOTO = {
  minTargetWidth: 1200,
  maxTargetWidth: 1800,
  maxScale: 2.6,
  pad: 18,
  skipMoiré: false,
  maxPasses: 4,
  allowBinarize: true,
  allowPsmFallback: true,
  maxPhotoBands: 5,
  photoMaxSide: 2000,
};

export function isMobileVinScanDevice() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const narrow = window.matchMedia?.('(max-width: 768px)')?.matches;
  const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return Boolean(coarse || narrow || touch);
}

export function getVinScanTiming() {
  const mobile = isMobileVinScanDevice();
  return {
    liveIntervalMs: mobile ? 1500 : 600,
    barcodeEveryNTicks: mobile ? 2 : 1,
  };
}

export function getCameraVideoConstraints() {
  if (isMobileVinScanDevice()) {
    return {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
  }
  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
}

/** @param {VinOcrProfileName} mode */
export function getVinOcrProfile(mode = 'live') {
  const mobile = isMobileVinScanDevice();
  if (mode === 'manual') return mobile ? MOBILE_MANUAL : DESKTOP_MANUAL;
  if (mode === 'photo') return mobile ? MOBILE_PHOTO : DESKTOP_PHOTO;
  return mobile ? MOBILE_LIVE : DESKTOP_LIVE;
}

export function liveScanStatusLabel({ engineReady, processing, scanHint, scanProgress, mobile }) {
  if (!engineReady) return 'Готовим распознавание…';
  if (processing) return mobile ? 'Считываем рамку… (~2 сек)' : 'Считываем рамку…';
  if (scanHint) return scanHint;
  if (mobile && scanProgress <= 0) return 'Держите VIN в рамке — считаем автоматически';
  if (scanProgress <= 0) return 'Держите VIN в рамке — считаем автоматически';
  if (scanProgress < 0.35) return mobile ? 'Читаем… (~2 сек)' : 'Читаем…';
  if (scanProgress < 0.7) return 'Почти готово…';
  return 'Проверяем результат…';
}
