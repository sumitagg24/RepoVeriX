import { defineConfig, devices } from '@playwright/test';

/**
 * RepoVeriX E2E — smoke + responsive + a11y basics.
 * Public surfaces run against the production build with no backend;
 * authenticated routes assert the login redirect (no fabricated session).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run start -- -p 3100',
    port: 3100,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
