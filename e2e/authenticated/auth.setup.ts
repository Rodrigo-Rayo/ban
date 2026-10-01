import { test as setup, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { AUTH_DIR, BAND_INFO, credentials, HAS_E2E_ACCOUNTS, SKIP_MESSAGE, STATE_A, STATE_B, type BandInfo } from './support/env';

// Logs both accounts in through the real login form and stores their sessions.
setup.skip(!HAS_E2E_ACCOUNTS, SKIP_MESSAGE);

async function loginAndSave(page: Page, email: string, password: string, statePath: string): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bandyou_cookie_consent', 'accepted'));
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.locator('form button[type=submit]').click();
  await page.waitForURL(/\/home/, { timeout: 20_000 });
  await page.context().storageState({ path: statePath });
}

setup('log in user A (musician)', async ({ page }) => {
  await loginAndSave(page, credentials.a.email, credentials.a.password, STATE_A);
});

setup('log in user B (band) and locate its public profile', async ({ page }) => {
  await loginAndSave(page, credentials.b.email, credentials.b.password, STATE_B);

  await page.goto('/dashboard');
  const href = await page.getByRole('link', { name: 'Ver perfil' }).first().getAttribute('href');
  expect(href, 'B must have a band profile (finish onboarding as a band)').toMatch(/^\/bands\/[0-9a-f-]{36}$/);

  await page.goto(href as string);
  const name = (await page.locator('h1').first().innerText()).trim();
  const info: BandInfo = { path: href as string, name };
  fs.writeFileSync(BAND_INFO, JSON.stringify(info));
});
