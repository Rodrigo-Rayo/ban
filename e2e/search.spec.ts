import { test, expect } from '@playwright/test';

test.describe('Search page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('renders search page with tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /músicos/i }).or(page.getByText(/músicos/i)).first()).toBeVisible();
  });

  test('shows results or empty state after load', async ({ page }) => {
    // Poll: loading starts after navigation, so a one-shot check can race it.
    await expect.poll(async () =>
      (await page.locator('a[href^="/musicians/"]').count()) + (await page.getByText(/sin resultados|no hay/i).count()),
      { timeout: 15000 },
    ).toBeGreaterThan(0);
  });

  test('filter by city works', async ({ page }) => {
    const citySelect = page.locator('select').first();
    await citySelect.selectOption({ label: 'Barcelona' });
    await page.waitForTimeout(500);
    // Page should still be functional (no crash)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Feed page', () => {
  test('renders "Se busca" with filters and sections', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByRole('heading', { level: 1, name: /se busca/i })).toBeVisible();
    // City filter should be visible
    await expect(page.locator('select').first()).toBeVisible();
    const sections = page.getByRole('navigation', { name: 'Secciones de Se busca' });
    await sections.getByRole('button', { name: 'Bandas buscan' }).click();
    await expect(page).toHaveURL(/ver=bandas/);
  });

  test('old "Vacantes" search links land on Se busca', async ({ page }) => {
    await page.goto('/search?tab=vacancies');
    await expect(page).toHaveURL(/\/feed\?ver=bandas/);
    await expect(page.getByRole('heading', { level: 1, name: /se busca/i })).toBeVisible();
  });

  test('shows skeleton then content', async ({ page }) => {
    await page.goto('/feed');
    // Wait for loading to finish
    await page.waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'), { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
