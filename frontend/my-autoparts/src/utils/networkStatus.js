export class NetworkOfflineError extends Error {
  constructor(message = 'Нет подключения к интернету') {
    super(message);
    this.name = 'NetworkOfflineError';
  }
}

export function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isMutatingHttpMethod(method) {
  const normalized = String(method || 'GET').toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD' && normalized !== 'OPTIONS';
}

export function assertOnlineForMutation(method) {
  if (isBrowserOffline() && isMutatingHttpMethod(method)) {
    throw new NetworkOfflineError();
  }
}

export const SW_UPDATE_EVENT = 'sg-sw-update-available';

export function dispatchSwUpdateAvailable(registration) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT, { detail: { registration } }));
}
