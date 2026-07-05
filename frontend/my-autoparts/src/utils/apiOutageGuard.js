const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 30000;

let outageUntil = 0;
let consecutiveFailures = 0;

export function isRetryableStatus(status) {
  return RETRYABLE_STATUSES.has(status);
}

export function registerApiFailure(status) {
  if (!isRetryableStatus(status)) return;
  consecutiveFailures += 1;
  const backoff = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * (2 ** Math.max(0, consecutiveFailures - 1)),
  );
  outageUntil = Date.now() + backoff;
}

export function registerApiSuccess() {
  consecutiveFailures = 0;
  outageUntil = 0;
}

export function isApiOutage() {
  return Date.now() < outageUntil;
}

export function getOutageRemainingMs() {
  return Math.max(0, outageUntil - Date.now());
}

export function getRetryDelayMs(retryCount = 0) {
  const outageDelay = getOutageRemainingMs();
  if (outageDelay > 0) return outageDelay;
  return 800 * (retryCount + 1);
}

export function getOutageMessage() {
  const sec = Math.ceil(getOutageRemainingMs() / 1000);
  if (sec <= 0) {
    return 'Сервер временно недоступен. Попробуйте ещё раз через несколько секунд.';
  }
  return `Сервер временно недоступен. Повтор через ~${sec} с.`;
}
