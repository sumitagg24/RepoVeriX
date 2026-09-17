import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Dismiss the cookie-consent dialog (appears ~900ms after load) when present. */
async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: /cookie consent/i });
  try {
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    // Exact name: the dialog's X close button ("Reject non-essential cookies")
    // is a different accessible name and must not match here.
    await page.getByRole('button', { name: 'Reject non-essential', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    /* already dismissed, stored from a previous test, or never shown */
  }
}

/** No horizontal page overflow at any tested viewport. */
async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
}

test.describe('landing', () => {
  test('hero communicates the evidence loop', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /repository intelligence/i })).toBeVisible();
    await expect(page.getByText(/follow the evidence|shows its work|verify the fix/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /start free/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^tools$/i }).first()).toBeVisible();
    await expectNoOverflow(page);
    expect(errors, 'console page errors').toEqual([]);
  });
});

test.describe('tools catalog', () => {
  test('lists real tools, search filters, empty state recovers', async ({ page }) => {
    await page.goto('/tools');
    await expect(page.getByRole('heading', { name: /every capability/i })).toBeVisible();
    await expect(page.getByText('SARIF Export')).toBeVisible();
    await expect(page.getByText('Proof of Fix')).toBeVisible();

    const search = page.getByLabel('Search tools');
    await search.fill('sarif');
    await expect(page.getByText('SARIF Export')).toBeVisible();
    await expect(page.getByText('Proof of Fix')).toHaveCount(0);

    await search.fill('zzz-no-such-tool');
    await expect(page.getByText(/no tools match/i)).toBeVisible();
    await page.getByRole('button', { name: /clear search/i }).click();
    await expect(page.getByText('Proof of Fix')).toBeVisible();
    await expectNoOverflow(page);
  });

  test('category tabs filter the catalog', async ({ page }) => {
    await page.goto('/tools');
    await page.getByRole('tab', { name: 'Website' }).click();
    await expect(page.getByText('Website Audit')).toBeVisible();
    await expect(page.getByText('SARIF Export')).toHaveCount(0);
  });
});

test.describe('auth', () => {
  test('login renders branded shell with validation', async ({ page }) => {
    await page.goto('/auth/login');
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    // Empty submit surfaces inline validation, no navigation.
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText('Invalid email address')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expectNoOverflow(page);
  });

  test('signup validates password match', async ({ page }) => {
    await page.goto('/auth/signup');
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: /create your workspace/i })).toBeVisible();
    await page.getByLabel('Full name').fill('E2E Tester');
    await page.getByLabel('Email').fill('e2e@example.com');
    await page.getByLabel(/^password$/i).fill('long-enough-passphrase');
    await page.getByLabel(/^confirm$/i).fill('different-passphrase');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('forgot password validates, then submits safely', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/auth/forgot-password');
    await dismissCookies(page);
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText('Invalid email address')).toBeVisible();
    await page.getByLabel('Email').fill('someone@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();
    // With no backend, a safe error toast appears; with a backend, the sent
    // state appears. Either way: no crash, no navigation away, no leak of
    // whether the account exists.
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    await expectNoOverflow(page);
    expect(errors, 'console page errors').toEqual([]);
  });
});

test.describe('authenticated shell (logged out)', () => {
  for (const route of ['/dashboard', '/repositories', '/findings', '/scans', '/websites', '/settings']) {
    test(`${route} redirects to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15000 });
    });
  }
});

test.describe('keyboard + theme', () => {
  test('tab reaches primary actions on tools', async ({ page }) => {
    await page.goto('/tools');
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(tag);
  });

  test('theme toggle switches to dark mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('switch', { name: /switch to dark theme/i }).click();
    await expect(page.locator('html.dark')).toBeAttached({ timeout: 5000 });
    await expect(page.getByRole('switch', { name: /switch to light theme/i })).toBeVisible();
  });
});
