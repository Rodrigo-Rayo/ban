import { test, expect, Page } from '@playwright/test';

// Regression tests for issues found in the 2026-09 audit. Read-only: no data is written.

const robots = (page: Page) => page.locator('meta[name="robots"]');

test.beforeEach(async ({ page }) => {
  // Pre-accept cookies so the banner does not cover the page under test.
  await page.addInitScript(() => localStorage.setItem('bandyou_cookie_consent', 'accepted'));
});

test.describe('SEO', () => {
  test('noindex from an auth page does not leak onto the next page', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(robots(page)).toHaveAttribute('content', /noindex/);

    // In-app navigation (no reload): login → register → privacy policy link.
    await page.getByRole('link', { name: /regístrate/i }).click();
    await expect(page).toHaveURL(/auth\/register/);
    // The site footer link opens in the same tab (the form's link opens a new one).
    await page.locator('footer').getByRole('link', { name: /privacidad/i }).click();
    await expect(page).toHaveURL(/legal\/privacidad/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(robots(page)).toHaveAttribute('content', /index,follow/);
  });

  test('cold load of a private route without seo.set() is noindex', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page).toHaveTitle(/Recuperar contraseña/);
    await expect(robots(page)).toHaveAttribute('content', /noindex/);
  });

  test('unknown profile id is marked noindex', async ({ page }) => {
    await page.goto('/musicians/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveTitle(/No encontrado/);
    await expect(robots(page)).toHaveAttribute('content', /noindex/);
  });

  test('canonical ignores query strings and uses the primary host', async ({ page }) => {
    await page.goto('/shop?utm_source=test');
    await expect(page).toHaveTitle(/Tienda/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.bandyou.es/shop');
  });
});

test.describe('Search', () => {
  test('typing in search keeps focus while the URL updates', async ({ page }) => {
    await page.goto('/search');
    const input = page.getByRole('searchbox').first();
    await input.click();
    await input.pressSequentially('guitarra', { delay: 80 });
    await page.waitForURL(/q=guit/);
    await input.pressSequentially(' rock', { delay: 50 });
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('guitarra rock');
  });

  test('city filter shows its selected option (ngModel inside form)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/search');
    const city = page.locator('select[name="city"]');
    await expect(city).toBeVisible();
    expect(await city.evaluate((s: HTMLSelectElement) => s.selectedOptions[0]?.textContent?.trim())).toBeTruthy();
    expect(errors.filter(e => e.includes('NG01352'))).toEqual([]);
  });
});

test.describe('Search page filters', () => {
  test('restore from the URL and keep existing filters when adding one', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/search?tab=musicians&city=Madrid&q=gui');
    const side = page.locator('main');
    await expect(side.getByLabel('Filtrar por ciudad')).toHaveValue('Madrid');
    await expect(side.getByLabel('Buscar en el directorio')).toHaveValue('gui');
    await side.getByLabel('Filtrar por instrumento').selectOption({ index: 2 });
    await expect(page).toHaveURL(/city=Madrid/);
    await expect(page).toHaveURL(/q=gui/);
    await expect(page).toHaveURL(/instrument=/);
  });
});

test.describe('Profiles', () => {
  test('availability tags never show raw array braces', async ({ page }) => {
    await page.goto('/search');
    const links = page.locator('a[href^="/musicians/"]');
    await expect(links.first()).toBeVisible({ timeout: 15000 });
    const hrefs = (await links.evaluateAll(as => as.map(a => a.getAttribute('href')))).slice(0, 6);
    for (const href of hrefs) {
      await page.goto(href!);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('main')).not.toContainText(/[{}]/);
    }
  });
});

test.describe('Access control', () => {
  for (const path of ['/home', '/inbox', '/dashboard', '/favorites', '/notifications', '/shop/new', '/events/create']) {
    test(`${path} redirects anonymous users to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  }
});
