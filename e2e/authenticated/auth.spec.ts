import { test, expect } from '@playwright/test';
import { credentials, HAS_E2E_ACCOUNTS, SKIP_MESSAGE } from './support/env';

test.skip(!HAS_E2E_ACCOUNTS, SKIP_MESSAGE);

test.describe('Authenticated: session', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('bandyou_cookie_consent', 'accepted'));
  });

  test('logs out and back in through the login form', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(credentials.a.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(credentials.a.password);
    await page.locator('form button[type=submit]').click();
    await page.waitForURL(/\/home/);

    await page.getByRole('button', { name: /^\s*Salir\s*$/ }).first().click();
    await page.waitForURL(url => !/\/home/.test(url.toString()));

    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(credentials.a.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(credentials.a.password);
    await page.locator('form button[type=submit]').click();
    await expect(page).toHaveURL(/\/home/);
  });

  test('shows a clear message on wrong password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(credentials.a.email);
    await page.getByLabel('Contraseña', { exact: true }).fill('definitely-not-the-password');
    await page.locator('form button[type=submit]').click();
    await expect(page.getByText(/Credenciales incorrectas/).first()).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
