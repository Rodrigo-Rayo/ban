import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Runs the suite against the deployed site (no local server). Override with E2E_BASE_URL.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: process.env['E2E_BASE_URL'] ?? 'https://www.bandyou.es' },
  webServer: undefined,
});
