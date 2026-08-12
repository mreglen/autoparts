const STORAGE_PREFIX = 'onboarding:';

export const ONBOARDING_KEYS = {
  MY_PARTS: `${STORAGE_PREFIX}my-parts:v1:completed`,
};

export function isOnboardingCompleted(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function clearOnboardingCompleted(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
