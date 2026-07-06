export const HAPTIC_PULL_READY = 40;
export const HAPTIC_PULL_REFRESH = [65, 35, 85];

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

let iosSwitchInput = null;

function ensureIosSwitchInput() {
  if (iosSwitchInput || typeof document === 'undefined') return iosSwitchInput;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  input.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'width:1px',
    'height:1px',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(input);
  iosSwitchInput = input;
  return iosSwitchInput;
}

function triggerIosSwitchHaptic(repeats = 1) {
  try {
    const input = ensureIosSwitchInput();
    if (!input) return false;
    for (let i = 0; i < repeats; i += 1) {
      input.checked = !input.checked;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  } catch {
    return false;
  }
}

export function triggerHaptic(pattern = 12) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(0);
      if (navigator.vibrate(pattern)) {
        return true;
      }
    } catch {
      // fall through to iOS fallback
    }
  }

  if (isIosDevice()) {
    return triggerIosSwitchHaptic(1);
  }

  return false;
}

export function triggerPullReadyHaptic() {
  return triggerHaptic(HAPTIC_PULL_READY);
}

export function triggerPullRefreshHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(0);
      if (navigator.vibrate(HAPTIC_PULL_REFRESH)) {
        return true;
      }
    } catch {
      // fall through
    }
  }

  if (isIosDevice()) {
    return triggerIosSwitchHaptic(2);
  }

  return false;
}

/** Короткая пауза, чтобы мотор успел отработать до тяжёлой работы / reload. */
export function waitForHaptic(ms = 55) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
