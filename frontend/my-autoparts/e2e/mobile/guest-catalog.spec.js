import { test, expect } from '../fixtures/base';
import { mockNewPartCard } from '../fixtures/apiMocks';

test.describe('Guest catalog → part detail', () => {
  test('opens new part card on mobile', async ({ page }) => {
    await page.goto('/autoparts/new/part/1001');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Колодки|Bosch/, {
      timeout: 15_000,
    });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
