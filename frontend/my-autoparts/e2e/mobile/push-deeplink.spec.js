import { test, expect } from '../fixtures/base';
import { seedAuthSession } from '../fixtures/base';

test.describe('Push deeplink navigation', () => {
  test('navigateToUrl custom event changes route', async ({ page }) => {
    await seedAuthSession(page);
    await page.goto('/');

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('navigateToUrl', { detail: { url: '/cart' } }),
      );
    });

    await expect(page).toHaveURL(/\/cart/, { timeout: 10_000 });
  });
});
