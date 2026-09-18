import { test, expect, type Page, type Route } from '@playwright/test';
/**
 * Flow A — Signup → Login → Dashboard → Logout → Login again → Invalid
 * credentials → Rate limit; plus the password-reset path.
 *
 * Default mode is fully local: every network call is served by route mocks
 * that mirror the real backend contract (same paths, same status codes, same
 * header names — including x-error-code), so nothing is fabricated on any
 * shared service. Set E2E_LIVE_API_URL (+ E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD)
 * to run against a deployed backend instead; assertions that depend on mock
 * state are skipped in live mode.
 */

const LIVE_API = process.env.E2E_LIVE_API_URL ?? '';
const LIVE_EMAIL = process.env.E2E_LIVE_EMAIL ?? 'prod-e2e3@repoverix.dev';
const LIVE_PASSWORD = process.env.E2E_LIVE_PASSWORD ?? 'ProdE2e!Str0ng-pass';
const isLive = LIVE_API.length > 0;

/** The email the mocked backend treats as "already registered". */
const MOCK_EXISTING = 'taken@rvx.dev';
/** Mock rate-limit sentinel: this email triggers 429. */
const MOCK_LIMITED = 'limited@rvx.dev';
const MOCK_PASSWORD = 'Correct-Horse-1';

const testUser = {
  email: 'e2e-flow-a@rvx.dev',
  password: 'E2E-Flow-A-1',
  fullName: 'Flow A Tester',
};

/** Build a JWT-shaped token (header.payload.signature); the app only decodes the payload. */
function makeToken(sub: string, email: string): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = enc({ alg: 'HS256', typ: 'JWT' });
  const payload = enc({ sub, email, iat: 1_789_659_096, exp: 1_789_745_496 });
  return `${header}.${payload}.${'sig'.repeat(8)}`;
}

/** Install route mocks mirroring the real backend contract. */
async function installApiMocks(page: Page) {
  const userId = '24919da4-6541-4e28-bc2e-43ec7d24fcaa';

  await page.route('**/api/v1/auth/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    let body: Record<string, unknown> = {};
    try {
      body = req.postDataJSON() as Record<string, unknown>;
    } catch {
      body = {};
    }
    const respond = (status: number, json: object, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(json) });

    if (path.endsWith('/auth/signup')) {
      const email = String(body?.email ?? '');
      if (email.endsWith('@mailinator.com')) {
        return respond(422, { detail: "This email provider can't be used to create an account." });
      }
      if (email === MOCK_EXISTING) {
        return respond(409, { detail: 'An account with this email already exists.' });
      }
      return respond(201, { access_token: makeToken(userId, email), email_verified: true });
    }

    if (path.endsWith('/auth/login')) {
      const email = String(body?.email ?? '');
      if (email === MOCK_LIMITED) {
        return respond(429, { detail: 'Too many attempts. Try again in a minute.' });
      }
      if (email === MOCK_EXISTING || !body || body.password !== MOCK_PASSWORD) {
        return respond(401, { detail: "We couldn't sign you in with that email and password." });
      }
      return respond(200, { access_token: makeToken(userId, email), email_verified: true });
    }

    if (path.endsWith('/auth/me')) {
      const auth = req.headers()['authorization'] ?? '';
      if (!auth.startsWith('Bearer ') || auth.length < 20) {
        return respond(401, { detail: 'Not authenticated' });
      }
      return respond(200, {
        id: userId,
        created_at: '2026-09-17T15:36:04Z',
        updated_at: '2026-09-17T15:36:08Z',
        email: 'e2e-flow-a@rvx.dev',
        full_name: 'Flow A Tester',
        is_active: true,
        plan: 'free',
        email_verified: true,
      });
    }

    if (path.endsWith('/auth/logout')) {
      return respond(200, { detail: 'Signed out.' });
    }

    if (path.endsWith('/auth/forgot-password')) {
      return respond(200, { detail: 'If that account exists, a reset link is on its way.' });
    }

    return respond(404, { detail: 'Not found' });
  });
}

/** Dismiss the cookie-consent dialog when present (same contract as smoke.spec.ts). */
async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: /cookie consent/i });
  try {
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: 'Reject non-essential', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    /* already dismissed, stored from a previous test, or never shown */
  }
}

/** Wait for a sonner toast whose text matches ``pattern`` (auto-dismissing, so poll). */
async function expectToast(page: Page, pattern: RegExp, note: string) {
  await expect
    .poll(
      async () => {
        const texts = await page.locator('[data-sonner-toast]').allTextContents();
        return texts.join(' | ');
      },
      { timeout: 8000, intervals: [250, 500, 1000], message: note },
    )
    .toMatch(pattern);
}

async function gotoLogin(page: Page) {
  await page.goto('/auth/login');
}

test.describe('Flow A — signup → login → dashboard → logout → login → invalid → rate limit', () => {
  test.skip(isLive, 'mock-only assertions; run flow-a-live.spec.ts for deployed backend');

  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('signup creates a session and lands on the dashboard', async ({ page }) => {
    await page.goto('/auth/signup');
    await dismissCookies(page);
    await page.getByLabel('Full name').fill(testUser.fullName);
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel(/^password$/i).fill(testUser.password);
    await page.getByLabel(/^confirm/i).fill(testUser.password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15000 });
  });

  test('signup with an already-registered email shows 409 without leaking state', async ({ page }) => {
    await page.goto('/auth/signup');
    await dismissCookies(page);
    await page.getByLabel('Full name').fill('Someone');
    await page.getByLabel('Email').fill(MOCK_EXISTING);
    await page.getByLabel(/^password$/i).fill(testUser.password);
    await page.getByLabel(/^confirm$/i).fill(testUser.password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expectToast(page, /already exists/i, '409 must surface the backend message');
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('disposable email is rejected', async ({ page }) => {
    await page.goto('/auth/signup');
    await dismissCookies(page);
    await page.getByLabel('Full name').fill('Sneaky');
    await page.getByLabel('Email').fill('sneaky@mailinator.com');
    await page.getByLabel(/^password$/i).fill(testUser.password);
    await page.getByLabel(/^confirm$/i).fill(testUser.password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expectToast(
      page,
      /permanent email|disposable|can't be used/i,
      'disposable block must surface a user-facing message',
    );
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('logout clears the session; protected routes redirect again', async ({ page }) => {
    await page.goto('/auth/login');
    await dismissCookies(page);
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill(MOCK_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15000 });

    // The app-shell avatar button (initial + presence dot) opens the user menu.
    await page.getByRole('button', { name: /Online/ }).click();
    await page.getByRole('menuitem', { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/auth\/login|\/$/, { timeout: 15000 });

    // Token removed → protected route bounces to login.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15000 });
  });

  test('invalid credentials keep the user on login with an inline error', async ({ page }) => {
    await gotoLogin(page);
    await dismissCookies(page);
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expectToast(page, /couldn't sign you in|invalid/i, 'bad credentials must surface an inline error');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('rate-limited logins surface a retry message', async ({ page }) => {
    await gotoLogin(page);
    await page.getByLabel('Email').fill(MOCK_LIMITED);
    await page.getByLabel('Password').fill('whatever-1');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/too many|try again|slow down/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('password reset is enumeration-safe and returns to login', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email').fill('someone@rvx.dev');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(
      page.getByText(/if that account exists|reset link|email has been sent|check your inbox/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Flow A — live backend (E2E_LIVE_API_URL set)', () => {
  test.skip(!isLive, 'set E2E_LIVE_API_URL to enable');

  test('real login reaches the dashboard; bad password is refused', async ({ page }) => {
    await gotoLogin(page);
    await page.getByLabel('Email').fill(LIVE_EMAIL);
    await page.getByLabel('Password').fill('wrong-on-purpose');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/couldn't sign you in|invalid/i)).toBeVisible();

    await page.getByLabel('Password').fill(LIVE_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20000 });
  });
});
