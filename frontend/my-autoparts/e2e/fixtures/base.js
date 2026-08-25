import { test as base, expect } from '@playwright/test';
import { installBaseMocks } from './apiMocks';
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from './testUsers';

export async function seedAuthSession(page) {
  await page.addInitScript(({ accessToken, refreshToken }) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }, {
    accessToken: MOCK_ACCESS_TOKEN,
    refreshToken: MOCK_REFRESH_TOKEN,
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cookie_consent_accepted', '1');
      } catch {
        // ignore
      }
      if (navigator.serviceWorker) {
        navigator.serviceWorker.register = async () => ({
          scope: '/',
          update: () => {},
          waiting: null,
          addEventListener: () => {},
        });
      }
    });
    await installBaseMocks(page);
    await use(page);
  },
});

export { expect };
