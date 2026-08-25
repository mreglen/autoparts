import { test, expect } from '../fixtures/base';
import { installBuyerMocks } from '../fixtures/apiMocks';
import { seedAuthSession } from '../fixtures/base';

test.describe('Buyer checkout', () => {
  test('shows checkout form for authenticated buyer', async ({ page }) => {
    await installBuyerMocks(page);
    await seedAuthSession(page);
    await page.goto('/cart/new/checkout');

    await expect(page.getByRole('heading', { name: /оформление заказа/i })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole('button', { name: /оплатить/i })).toBeVisible();
  });
});
