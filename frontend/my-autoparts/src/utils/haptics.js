export function triggerHaptic(pattern = 12) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const HAPTIC_PULL_READY = 14;
export const HAPTIC_PULL_REFRESH = [16, 36, 16];
