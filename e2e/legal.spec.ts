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

  test('cookies policy renders', async ({ page }) => {
    await page.goto('/legal/cookies');
    await expect(page.getByRole('heading', { level: 1, name: /cookies/i })).toBeVisible();
  });
});

test.describe('404 page', () => {
  test('shows not found for unknown routes', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe-123');
    await expect(page.getByText('404')).toBeVisible();
    // Scope to the page body: the sidebar also has an "Inicio" link.
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

  test('hides banner after accepting', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('bandyou_cookie_consent'));
    await page.reload();
    const acceptBtn = page.getByRole('button', { name: /aceptar/i });
    await acceptBtn.click();
    await expect(page.getByText(/cookies esenciales/i)).not.toBeVisible();
  });
});
