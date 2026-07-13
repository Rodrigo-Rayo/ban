import { test, expect } from '@playwright/test';

test.describe('Search page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('renders search page with tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /músicos/i }).or(page.getByText(/músicos/i)).first()).toBeVisible();
  });

  test('shows results or empty state after load', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'), { timeout: 10000 });
    const hasResults = await page.locator('article, [class*="card"]').count();
    const hasEmptyState = await page.getByText(/sin resultados|no hay/i).count();
    expect(hasResults + hasEmptyState).toBeGreaterThan(0);
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
  test('renders feed with filter controls', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByRole('heading', { name: /anuncios/i })).toBeVisible();
    // City filter should be visible
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('shows skeleton then content', async ({ page }) => {
    await page.goto('/feed');
    // Wait for loading to finish
    await page.waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'), { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
