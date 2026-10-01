import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Runs the public suite against the production build (dist) served with the real CSP.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:4300' },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://localhost:4300',
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});
