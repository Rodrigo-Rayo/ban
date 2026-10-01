import { test, expect } from './support/fixtures';
import { HAS_E2E_ACCOUNTS, SKIP_MESSAGE } from './support/env';

test.skip(!HAS_E2E_ACCOUNTS, SKIP_MESSAGE);

const REALTIME_TIMEOUT = 15_000;
const CONVERSATION_URL = /\/inbox\/[0-9a-f-]{36}/;

test('two users chat in realtime (A desktop musician, B mobile band)', async ({ pageA, pageB, band }) => {
  test.setTimeout(150_000);
  const tag = `E2E ${Date.now()}`;
  const fromA = `${tag} hola, soy A`;
  const fromB = `${tag} respuesta de B`;
  const messageBox = (page: typeof pageA) => page.getByLabel('Escribe un mensaje');
  const bottomNav = pageB.locator('nav[aria-label="Navegación inferior"]');

  // B idles on home: realtime listeners live in the navbar.
  await pageB.goto('/home');
  await expect(bottomNav).toBeVisible();

  await test.step('A opens a chat from the band profile', async () => {
    await pageA.goto(band.path);
    await pageA.locator('button:visible', { hasText: /mensaje/i }).first().click();
    await expect(pageA).toHaveURL(CONVERSATION_URL);
  });
  const conversationUrl = pageA.url();

  await test.step('A sends a message and sees it, not marked as failed', async () => {
    await messageBox(pageA).fill(fromA);
    await messageBox(pageA).press('Enter');
    await expect(pageA.getByText(fromA).first()).toBeVisible();
    await expect(pageA.getByText(/No enviado/)).toHaveCount(0);
  });

  await test.step('B gets a realtime toast and an unread badge without reloading', async () => {
    await expect(pageB.getByText(fromA.slice(0, 30)).first()).toBeVisible({ timeout: REALTIME_TIMEOUT });
    await expect(bottomNav).toContainText(/[1-9]/);
  });

  await test.step('B opens the conversation from the inbox and replies', async () => {
    await pageB.goto('/inbox');
    await pageB.getByText(fromA).first().click();
    await expect(pageB).toHaveURL(CONVERSATION_URL);
    await expect(pageB.getByText(fromA).first()).toBeVisible();
    await messageBox(pageB).fill(fromB);
    await messageBox(pageB).press('Enter');
  });

  await test.step('A receives the reply in realtime', async () => {
    await expect(pageA.getByText(fromB).first()).toBeVisible({ timeout: REALTIME_TIMEOUT });
  });

  await test.step('B unread badge clears after reading', async () => {
    await pageB.goto('/home');
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav).not.toContainText(/[1-9]/);
  });

  await test.step('history persists after reload', async () => {
    await pageA.goto(conversationUrl);
    await expect(pageA.getByText(fromA).first()).toBeVisible();
    await expect(pageA.getByText(fromB).first()).toBeVisible();
  });

  await test.step('whitespace-only message is not sent', async () => {
    const bubbles = pageA.locator('[role=log] p');
    const before = await bubbles.count();
    await messageBox(pageA).fill('   ');
    await messageBox(pageA).press('Enter');
    await expect(messageBox(pageA)).toBeVisible();
    // Give a wrongly-sent message the chance to appear, then assert nothing was added.
    await expect.poll(() => bubbles.count(), { timeout: 3_000 }).toBe(before);
  });
});
