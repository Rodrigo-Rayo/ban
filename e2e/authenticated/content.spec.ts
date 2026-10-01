import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { HAS_E2E_ACCOUNTS, SKIP_MESSAGE } from './support/env';
import { solidPng } from './support/png';

test.skip(!HAS_E2E_ACCOUNTS, SKIP_MESSAGE);

// Everything created here carries this tag and is removed through the UI at the end of each test.
const TAG = `E2E ${Date.now()}`;
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const UPLOAD_TIMEOUT = 20_000;
const IMAGE = { name: 'e2e.png', mimeType: 'image/png', buffer: solidPng() };

/** `confirm()` dialogs guard every destructive action in the app. */
function acceptDialogs(page: Page): void {
  page.on('dialog', dialog => void dialog.accept());
}

async function expectImageLoaded(page: Page, selector: string): Promise<void> {
  const image = page.locator(selector).first();
  await expect(image).toBeVisible({ timeout: UPLOAD_TIMEOUT });
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: UPLOAD_TIMEOUT })
    .toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.describe('Authenticated: content flows', () => {
  test('A publishes a feed post and deletes it', async ({ pageA }) => {
    acceptDialogs(pageA);
    const text = `${TAG} músico busca banda de rock`;
    try {
      await pageA.goto('/feed?new=1');
      await pageA.locator('textarea').first().fill(text);
      await pageA.getByRole('button', { name: /^\s*Publicar anuncio\s*$/ }).first().click();
      await expect(pageA.getByText(text).first()).toBeVisible();
    } finally {
      await deleteFromDashboard(pageA, 'Anuncios', new RegExp(`Eliminar anuncio: .*${TAG}`));
    }
  });

  test('A creates an event (time is required) and deletes it', async ({ pageA }) => {
    acceptDialogs(pageA);
    const title = `${TAG} concierto`;
    try {
      await pageA.goto('/events/create');
      await pageA.fill('#event-title', title);
      await pageA.fill('#event-venue', 'Sala E2E');
      await pageA.selectOption('#event-city', { index: 1 });
      await pageA.fill('#event-date', TOMORROW);
      await pageA.selectOption('#event-genre', { index: 1 });
      await pageA.fill('#event-description', 'Evento de prueba E2E. Se borra al terminar.');

      // Time is NOT NULL in the database: the form must refuse to submit without it.
      await pageA.locator('form button[type=submit]').click();
      await expect(pageA.locator('#event-time-error')).toBeVisible();
      await expect(pageA).toHaveURL(/\/events\/create/);

      await pageA.fill('#event-time', '21:00');
      await pageA.locator('form button[type=submit]').click();
      await expect(pageA).toHaveURL(/\/(events\/[0-9a-f-]{36}|dashboard)/);
      await expect(pageA.getByText(title).first()).toBeVisible();
    } finally {
      await deleteFromDashboard(pageA, 'Eventos', new RegExp(`Eliminar evento: ${TAG}`));
    }
  });

  test('A sells gear with a photo that actually loads, then deletes the listing', async ({ pageA }) => {
    acceptDialogs(pageA);
    const title = `${TAG} pedal`;
    let listingUrl = '';
    try {
      await pageA.goto('/shop/new');
      await pageA.locator('input[type=file]').first().setInputFiles(IMAGE);
      await pageA.fill('#gear-title', title);
      await pageA.fill('#gear-price', '42');
      await pageA.selectOption('#gear-condition', { index: 1 });
      await pageA.selectOption('#gear-category', { index: 1 });
      await pageA.selectOption('#gear-city', { index: 1 });
      await pageA.fill('#gear-description', 'Artículo de prueba E2E. Se borra al terminar.');
      await pageA.getByRole('button', { name: /^\s*Publicar anuncio\s*$/ }).click();
      await expect(pageA).toHaveURL(/\/shop\/[0-9a-f-]{36}$/, { timeout: UPLOAD_TIMEOUT });
      listingUrl = pageA.url();
      await expect(pageA.getByText(title).first()).toBeVisible();
      await expectImageLoaded(pageA, 'main img[src*="gear-images"]');
    } finally {
      if (listingUrl) {
        if (pageA.url() !== listingUrl) await pageA.goto(listingUrl);
        await pageA.getByRole('button', { name: 'Eliminar anuncio' }).click();
        await expect(pageA).not.toHaveURL(listingUrl);
      }
    }
  });

  test('B opens a vacancy, A applies, B is notified; vacancy is closed afterwards', async ({ pageA, pageB, band }) => {
    acceptDialogs(pageB);
    const description = `${TAG} vacante`;
    const vacancyCard = (page: Page) =>
      page.locator('div', { hasText: description }).filter({ has: page.getByRole('button') }).last();
    try {
      await pageB.goto(band.path);
      await pageB.getByRole('button', { name: /Añadir vacante/ }).click();
      await pageB.locator('select').first().selectOption({ index: 1 });
      await pageB.locator('textarea').first().fill(description);
      await pageB.getByRole('button', { name: /Publicar vacante/ }).click();
      await expect(pageB.getByText(description).first()).toBeVisible();

      await pageA.goto(band.path);
      await vacancyCard(pageA).getByRole('button', { name: /Postularme/ }).click();
      await pageA.locator('[role=dialog] textarea').fill(`${TAG} me interesa`);
      await pageA.getByRole('button', { name: /Enviar solicitud/ }).click();
      await expect(pageA.getByText('Solicitud enviada').first()).toBeVisible();

      await pageB.goto('/notifications');
      await expect(pageB.locator('main')).toContainText(/solicitud|postul|candidat/i);
    } finally {
      await pageB.goto(band.path);
      const closeButton = vacancyCard(pageB).getByRole('button', { name: /^\s*Cerrar\s*$/ });
      if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
    }
  });

  test('A adds the band to favorites and removes it again', async ({ pageA, band }) => {
    const saveButton = pageA.locator('button:visible', { hasText: /^\s*Guardar\s*$/ }).first();
    const savedButton = pageA.locator('button:visible', { hasText: /^\s*Guardado\s*$/ }).first();
    await pageA.goto(band.path, { waitUntil: "networkidle" });
    // A previous aborted run may have left it saved.
    if (await savedButton.isVisible().catch(() => false)) {
      await savedButton.click();
      await expect(saveButton).toBeVisible();
    }
    try {
      await saveButton.click();
      await expect(savedButton).toBeVisible();
      await pageA.goto('/favorites');
      await expect(pageA.getByText(band.name).first()).toBeVisible();
    } finally {
      await pageA.goto(band.path, { waitUntil: "networkidle" });
      if (await savedButton.isVisible().catch(() => false)) {
        await savedButton.click();
        await expect(saveButton).toBeVisible();
      }
    }
  });

  test('B (mobile) uploads an avatar', async ({ pageB }) => {
    await pageB.goto('/dashboard');
    await pageB.locator('input[type=file]').first().setInputFiles(IMAGE);
    await expectImageLoaded(pageB, 'img[src*="avatars"]:visible');
  });
});

/** Deletes an item the logged-in user owns from its dashboard tab. */
async function deleteFromDashboard(page: Page, tabName: string, deleteLabel: RegExp): Promise<void> {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: new RegExp(tabName) }).first().click();
  const deleteButton = page.getByRole('button', { name: deleteLabel });
  if (await deleteButton.count() === 0) return;
  await deleteButton.first().click();
  await expect(deleteButton).toHaveCount(0);
}
