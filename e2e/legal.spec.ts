import { test, expect } from '@playwright/test';

test.describe('Legal pages', () => {
  test('privacy policy renders with RGPD content', async ({ page }) => {
    await page.goto('/legal/privacidad');
    await expect(page.getByRole('heading', { level: 1, name: /privacidad/i })).toBeVisible();
    await expect(page.getByText(/responsable/i).first()).toBeVisible();
    await expect(page.getByText(/derechos/i).first()).toBeVisible();
  });

  test('terms of service renders', async ({ page }) => {
    await page.goto('/legal/terminos');
    await expect(page.getByRole('heading', { level: 1, name: /términos/i })).toBeVisible();
    await expect(page.getByText(/elegibilidad|cuenta/i).first()).toBeVisible();
  });

  test('aviso legal renders with LSSI identification block', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    await expect(page.getByRole('heading', { level: 1, name: /aviso legal/i })).toBeVisible();
    await expect(page.getByText(/Titular/).first()).toBeVisible();
  });

  test('cookies policy renders', async ({ page }) => {
    await page.goto('/legal/cookies');
    await expect(page.getByRole('heading', { level: 1, name: /cookies/i })).toBeVisible();
  });
});

test.describe('404 page', () => {
  test('shows not found for unknown routes', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe-123');
    await expect(page.getByText('404')).toBeVisible();
    // Scope to the page body: the navigation also links home.
    await expect(page.locator('main').getByRole('link', { name: /inicio/i })).toBeVisible();
  });
});

test.describe('Cookie banner', () => {
  test('shows cookie banner on first visit', async ({ page }) => {
    // Clear storage to simulate first visit
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('bandyou_cookie_consent'));
    await page.reload();
    await expect(page.getByText(/cookies esenciales/i)).toBeVisible({ timeout: 5000 });
  });

  test('hides banner after dismissing (informational notice, no accept/reject)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('bandyou_cookie_consent'));
    await page.reload();
    await expect(page.getByRole('button', { name: /rechazar/i })).toHaveCount(0);
    await page.getByRole('button', { name: /entendido/i }).click();
    await expect(page.getByText(/cookies esenciales/i)).not.toBeVisible();
  });
});
