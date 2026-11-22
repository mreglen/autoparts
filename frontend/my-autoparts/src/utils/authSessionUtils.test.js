import { decodeJwtPayload, getRenewDelayMs, isTokenNearExpiry, getTokenExpiryMs, isAuthEngagementError } from './authSessionUtils';

function makeToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('authSessionUtils', () => {
  it('decodes jwt payload exp', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeToken({ sub: 'user@test.com', exp });
    expect(getTokenExpiryMs(token)).toBe(exp * 1000);
    expect(decodeJwtPayload(token)?.sub).toBe('user@test.com');
  });

  it('schedules renew before expiry', () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = makeToken({ exp });
    const delay = getRenewDelayMs(token, 120);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(180 * 1000);
  });

  it('detects near expiry', () => {
    const exp = Math.floor(Date.now() / 1000) + 30;
    const token = makeToken({ exp });
    expect(isTokenNearExpiry(token, 120)).toBe(true);
  });

  it('detects auth errors in russian and english', () => {
    expect(isAuthEngagementError('Сессия истекла или недействительна')).toBe(true);
    expect(isAuthEngagementError('Refresh-токен недействителен')).toBe(true);
    expect(isAuthEngagementError('Не удалось проверить учетные данные')).toBe(true);
    expect(isAuthEngagementError('HTTP 401: Unauthorized')).toBe(true);
    expect(isAuthEngagementError('Сервер не отвечает. Попробуйте ещё раз.')).toBe(false);
    expect(isAuthEngagementError('Не удалось загрузить расходы')).toBe(false);
  });
});
