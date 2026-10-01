import { defineConfig, devices } from '@playwright/test';
import { HAS_E2E_ACCOUNTS } from './e2e/authenticated/support/env';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // Authenticated specs share two real accounts, so they must not run concurrently.
  workers: process.env['CI'] || HAS_E2E_ACCOUNTS ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /authenticated\//,
    },
    // Authenticated flows (write to the database of the app under test). Skipped unless
    // E2E_USER_A_* / E2E_USER_B_* are set; see e2e/authenticated/README.md.
    {
      name: 'setup',
      testMatch: /authenticated\/auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'authenticated',
      testMatch: /authenticated\/.*\.spec\.ts/,
      dependencies: ['setup'],
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120 * 1000,
  },
});
