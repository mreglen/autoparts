// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-360',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
        userAgent: devices['Pixel 5'].userAgent,
      },
    },
    {
      name: 'mobile-390',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: devices['iPhone 12'].userAgent,
      },
    },
  ],
  webServer: {
    command: `npx serve -s build -l ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
