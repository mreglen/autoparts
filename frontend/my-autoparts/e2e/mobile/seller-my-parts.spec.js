import { test, expect } from '../fixtures/base';
import { installSellerMocks } from '../fixtures/apiMocks';
import { seedAuthSession } from '../fixtures/base';

test.describe('Seller my-parts', () => {
  test('lists seller inventory on mobile', async ({ page }) => {
    await installSellerMocks(page);
    await seedAuthSession(page);
    await page.goto('/my-parts');

    await expect(page.getByRole('heading', { name: 'Фара левая' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Toyota · 8111002A80/)).toBeVisible();
  });
});
