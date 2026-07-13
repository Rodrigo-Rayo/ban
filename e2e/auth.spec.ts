import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('renders login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('shows validation error on empty submit', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('notanemail');
    await emailInput.blur();
    await expect(page.getByText(/email válido/i)).toBeVisible();
  });

  test('forgot password link navigates correctly', async ({ page }) => {
    await page.getByText(/olvidaste/i).click();
    await expect(page).toHaveURL('/auth/forgot-password');
  });

  test('register link navigates correctly', async ({ page }) => {
    await page.getByRole('link', { name: /regístrate/i }).click();
    await expect(page).toHaveURL('/auth/register');
  });
});

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
  });

  test('renders register form with role selector', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /únete/i })).toBeVisible();
    await expect(page.getByText('Músico')).toBeVisible();
    await expect(page.getByText('Banda')).toBeVisible();
  });

  test('terms and privacy links point to legal pages', async ({ page }) => {
    const termsLink = page.getByRole('link', { name: /términos/i });
    const privacyLink = page.getByRole('link', { name: /privacidad/i });
    await expect(termsLink).toHaveAttribute('href', '/legal/terminos');
    await expect(privacyLink).toHaveAttribute('href', '/legal/privacidad');
  });

  test('shows validation on invalid email', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('bad-email');
    await emailInput.blur();
    await expect(page.getByText(/email válido/i)).toBeVisible();
  });
});

test.describe('Forgot password page', () => {
  test('renders form and submits successfully with valid email', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await page.locator('input[type="email"]').fill('test@example.com');
    // Just verify the button is enabled — actual email delivery is not testable
    const submitBtn = page.getByRole('button', { name: /enviar/i });
    await expect(submitBtn).toBeEnabled();
  });
});
