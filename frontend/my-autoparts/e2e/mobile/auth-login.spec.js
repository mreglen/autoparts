import { test, expect } from '../fixtures/base';
import { installBuyerMocks } from '../fixtures/apiMocks';
import { seedAuthSession } from '../fixtures/base';
import { MOCK_ACCESS_TOKEN } from '../fixtures/testUsers';

test.describe('Auth login / logout', () => {
  test('logs in and clears session on logout path', async ({ page }) => {
    await installBuyerMocks(page);

    await page.goto('/auth');
    await page.getByLabel(/email или телефон/i).fill('buyer@test.ru');
    await page.locator('#auth-password').fill('secret');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('token'))).toBe(MOCK_ACCESS_TOKEN);

    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
    });
    await page.goto('/cart/new/checkout');
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });
  });
});
