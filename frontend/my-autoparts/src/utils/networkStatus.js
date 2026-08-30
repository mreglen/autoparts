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
