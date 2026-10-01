import { test as base, devices, expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { BAND_INFO, STATE_A, STATE_B, type BandInfo } from './env';

interface Fixtures {
  /** User A: desktop, logged in as the musician. */
  pageA: Page;
  /** User B: iPhone 13, logged in as the band. */
  pageB: Page;
  /** B's public band profile (path + name), discovered during setup. */
  band: BandInfo;
}

// `defaultBrowserType` is a Playwright device hint, not a context option.
const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13'];

async function newPage(browser: Browser, options: BrowserContextOptions): Promise<Page> {
  const context = await browser.newContext(options);
  await context.addInitScript(() => localStorage.setItem('bandyou_cookie_consent', 'accepted'));
  return context.newPage();
}

export const test = base.extend<Fixtures>({
  pageA: async ({ browser, baseURL }, use) => {
    const page = await newPage(browser, { baseURL, storageState: STATE_A, viewport: { width: 1366, height: 900 } });
    await use(page);
    await page.context().close();
  },
  pageB: async ({ browser, baseURL }, use) => {
    const page = await newPage(browser, { ...iphone, baseURL, storageState: STATE_B });
    await use(page);
    await page.context().close();
  },
  // eslint-disable-next-line no-empty-pattern
  band: async ({}, use) => {
    await use(JSON.parse(fs.readFileSync(BAND_INFO, 'utf8')) as BandInfo);
  },
});

export { expect };
