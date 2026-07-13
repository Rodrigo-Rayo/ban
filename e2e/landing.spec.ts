import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads and shows call to action', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, [class*="hero"] h2, main h2').first()).toBeVisible();
    const cta = page.getByRole('link', { name: /empieza|únete|regístrate|entrar/i }).first();
    await expect(cta).toBeVisible();
  });

  test('navbar is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav, header').first()).toBeVisible();
  });
});
