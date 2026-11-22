export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

/** Milliseconds until scheduled renew (exp minus leadSeconds). */
export function getRenewDelayMs(token, leadSeconds = 120) {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) return null;
  const delay = expiryMs - Date.now() - leadSeconds * 1000;
  return delay > 0 ? delay : 0;
}

export function isTokenNearExpiry(token, leadSeconds = 120) {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) return true;
  return expiryMs - Date.now() <= leadSeconds * 1000;
}

export function isAuthEngagementError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('401')
    || text.includes('unauthorized')
    || text.includes('not authenticated')
    || text.includes('invalid')
    || text.includes('expired')
    || text.includes('signature')
    || text.includes('учетные данные')
    || text.includes('учётные данные')
    || text.includes('сессия')
    || text.includes('refresh-токен')
  );
}

export function isNetworkEngagementError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('failed to fetch')
    || text.includes('networkerror')
    || text.includes('network')
    || text.includes('не отвечает')
    || text.includes('name_not_resolved')
    || text.includes('load failed')
  );
}
