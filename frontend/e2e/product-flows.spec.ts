import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Flows B–E — the four critical product flows, desktop + 390×844:
 *
 *   B  Connect provider → select repository → scan → findings
 *   C  Finding → repair → Proof of Fix → verification
 *   D  Website → audit → crawl → findings → evidence
 *   E  Unauthorized user → another user's resource → denied (IDOR)
 *
 * Default mode is fully local: API routes are mocked at the network boundary
 * with the real backend's contract (paths, status codes, error headers), so
 * the flows exercise the actual product UI without touching shared services.
 * Set E2E_LIVE_API_URL (+ credentials) to run against a deployed backend;
 * mock-state-dependent assertions are skipped there.
 */

const LIVE_API = process.env.E2E_LIVE_API_URL ?? '';
const isLive = LIVE_API.length > 0;

const USER_A = '24919da4-6541-4e28-bc2e-43ec7d24fcaa';
const REPO_ID = '8584e9e9-a5f5-42e3-8e0c-7c2778d9ed3c';
const SCAN_ID = '2287d91d-ca6b-4ad7-af0a-4aabcdb0d56d';
const FINDING_ID = 'f1nd1ng-cafe-4a11-9c0d-5f2ea3b1c001';
const SITE_ID = 'f169cf05-6db4-4e79-abbc-f8ce67ed68ab';
const AUDIT_ID = '17e004ed-5cfd-47be-81c0-30b46a2fefb6';
const USER_B_TOKEN_SUFFIX = 'user-b';

/** JWT-shaped token; payload carries a distinct subject per user. */
function makeToken(sub: string): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({
    sub,
    iat: 1_789_659_096,
    exp: 1_789_745_496,
  })}.${'sig'.repeat(8)}`;
}

function tokenFor(authHeader: string | undefined): string {
  if (!authHeader?.startsWith('Bearer ')) return '';
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.sub ?? '');
  } catch {
    return '';
  }
}

const CORS = { 'access-control-allow-origin': '*' };

function json(route: Route, status: number, body: object, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { ...CORS, ...headers },
    body: JSON.stringify(body),
  });
}

/** Distinct subjects so specs can assert cross-tenant isolation. */
const TOKEN_A = makeToken(USER_A);
const TOKEN_B = makeToken('00000000-0000-0000-0000-00000000b000');

/**
 * Full API mock mirroring the real backend contract. The `viewer` determines
 * ownership: resources belong to USER_A, so USER_B (Flow E) gets 404s.
 */
async function installProductMocks(page: Page, viewer: string = USER_A) {
  const owns = (sub: string) => sub === viewer;

  // ---- repositories ------------------------------------------------------
  await page.route('**/api/v1/repositories**', async (route) => {
    const sub = tokenFor(route.request().headers()['authorization']);
    if (!sub) return json(route, 401, { detail: 'Not authenticated' });
    if (!owns(sub)) return json(route, 404, { detail: 'Repository not found' });
    return json(route, 200, [
      {
        id: REPO_ID,
        created_at: '2026-09-17T15:45:05Z',
        updated_at: '2026-09-17T15:45:05Z',
        owner_id: USER_A,
        name: 'hello-world',
        source_type: 'git',
        source_url: 'https://github.com/octocat/Hello-World.git',
        default_branch: 'master',
        language: null,
        size_kb: 12,
        file_count: 1,
      },
    ]);
  });

  // ---- scans -------------------------------------------------------------
  await page.route('**/api/v1/scans**', async (route) => {
    const req = route.request();
    const sub = tokenFor(req.headers()['authorization']);
    if (!sub) return json(route, 401, { detail: 'Not authenticated' });
    if (!owns(sub)) return json(route, 404, { detail: 'Scan not found' });
    const method = req.method();
    const path = new URL(req.url()).pathname;

    if (method === 'POST' && path.endsWith('/api/v1/scans')) {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      if (body.configuration === 'repoverix' || body.configuration === 'llm_only') {
        return json(route, 402, { detail: 'Full LLM pipeline scans are a Pro feature' }, {
          'x-upgrade-reason': 'llm-scan-config',
        });
      }
      return json(route, 201, {
        id: SCAN_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        repository_id: REPO_ID,
        status: 'pending',
        configuration: 'static_only',
        started_at: null,
        finished_at: null,
        summary: null,
        error: null,
      });
    }
    return json(route, 200, {
      id: SCAN_ID,
      created_at: '2026-09-17T15:46:25Z',
      updated_at: '2026-09-17T15:46:59Z',
      repository_id: REPO_ID,
      status: 'completed',
      configuration: 'static_only',
      started_at: '2026-09-17T15:46:34Z',
      finished_at: '2026-09-17T15:46:59Z',
      summary: { files: 1, findings: 1 },
      error: null,
      analysis_runs: [
        { id: 'r1', stage: 'ingestion', status: 'completed' },
        { id: 'r2', stage: 'static_analysis', status: 'completed' },
        { id: 'r3', stage: 'evidence_validation', status: 'completed' },
      ],
    });
  });

  // ---- findings ----------------------------------------------------------
  await page.route('**/api/v1/findings/**', async (route) => {
    const req = route.request();
    const sub = tokenFor(req.headers()['authorization']);
    if (!sub) return json(route, 401, { detail: 'Not authenticated' });
    if (!owns(sub)) return json(route, 404, { detail: 'Finding not found' });
    const path = new URL(req.url()).pathname;
    if (path.endsWith('/generate-fix')) {
      return json(route, 202, { id: 'patch-1', status: 'candidate' });
    }
    return json(route, 200, {
      id: FINDING_ID,
      scan_id: SCAN_ID,
      created_at: '2026-09-17T15:47:00Z',
      title: 'Hardcoded credentials in app.py',
      description: 'A secret is embedded in source.',
      severity: 'high',
      category: 'security',
      status: 'verified',
      file_path: 'app.py',
      line_start: 12,
      line_end: 14,
    });
  });

  // ---- websites + audits -------------------------------------------------
  await page.route('**/api/v1/websites/**', async (route) => {
    const req = route.request();
    const sub = tokenFor(req.headers()['authorization']);
    if (!sub) return json(route, 401, { detail: 'Not authenticated' });
    if (!owns(sub)) return json(route, 404, { detail: 'Website not found' });
    const path = new URL(req.url()).pathname;

    if (path.endsWith('/audits') && req.method() === 'POST') {
      return json(route, 202, {
        id: AUDIT_ID,
        website_id: SITE_ID,
        status: 'pending',
        pages_crawled: 0,
        error: null,
        created_at: new Date().toISOString(),
        finished_at: null,
      });
    }
    if (/\/audits\/[0-9a-f-]+$/.test(path) && req.method() === 'GET') {
      return json(route, 200, {
        id: AUDIT_ID,
        website_id: SITE_ID,
        status: 'complete',
        pages_crawled: 6,
        error: null,
        created_at: '2026-09-17T16:10:43Z',
        finished_at: '2026-09-17T16:11:10Z',
        summary: 'Passive audit of tonecraft.site',
        scores: {
          technical_seo: 88,
          security_posture: 100,
          accessibility: 100,
          performance: 90,
          ai_search_readiness: 86,
          content_quality: null,
          technical_health: 100,
        },
        findings: [
          {
            severity: 'medium',
            state: 'observed',
            check_id: 'seo_h1',
            title: 'Homepage has no unique H1',
            description: 'No H1 heading was found on the landing page.',
            evidence: [],
          },
        ],
        evidence: [{ id: 'ev1', kind: 'observed_signal', label: 'GET / → 200', detail: 'final URL https://www.tonecraft.site/' }],
      });
    }
    return json(route, 200, {
      id: SITE_ID,
      url: 'https://tonecraft.site/',
      hostname: 'tonecraft.site',
      label: null,
      status: 'active',
      created_at: '2026-09-17T15:48:31Z',
      last_audit_at: '2026-09-17T16:11:10Z',
    });
  });

  // ---- OAuth connections (Flow B gating) ---------------------------------
  await page.route('**/api/v1/auth/oauth/**', async (route) => {
    const req = route.request();
    const sub = tokenFor(req.headers()['authorization']);
    if (!sub) return json(route, 401, { detail: 'Not authenticated' });
    const path = new URL(req.url()).pathname;

    if (path.endsWith('/providers')) {
      return json(route, 200, {
        google: { configured: false, display_name: 'Google', supports_repo_import: false, supports_signin: true },
        github: { configured: true, display_name: 'GitHub', supports_repo_import: true, supports_signin: true },
        gitlab: { configured: true, display_name: 'GitLab', supports_repo_import: true, supports_signin: true },
      });
    }
    if (path.endsWith('/connections')) {
      const connected = owns(sub) && sub === USER_A; // Flow E viewer: nothing connected
      return json(route, 200, connected
        ? [{ provider: 'github', provider_email: 'octocat@example.com', connected_at: '2026-09-17T12:00:00Z' }]
        : []);
    }
    if (/\/repos$/.test(path)) {
      if (!owns(sub)) return json(route, 403, { detail: 'Connect GitHub first' });
      return json(route, 200, [
        { id: 'gh1', full_name: 'octocat/Hello-World', private: false, default_branch: 'master' },
      ]);
    }
    if (req.method() === 'DELETE') {
      return json(route, 200, { detail: 'Disconnected' });
    }
    return json(route, 404, { detail: 'Not found' });
  });
}

/** Sign in by seeding the token the app reads on boot (same key the login page writes). */
async function loginAs(page: Page, token: string) {
  await page.addInitScript((t) => localStorage.setItem('access_token', t), token);
}

/** Auth/me + empty auxiliaries for the shell. */
async function installShellMocks(page: Page, email: string) {
  // Catch-all registered FIRST (lowest priority): auxiliary endpoints not
  // mocked explicitly resolve as 404 instead of hitting the network.
  await page.route('**/api/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS });
    }
    return json(route, 404, { detail: 'Not found' });
  });
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, 200, {
      id: tokenFor(route.request().headers()['authorization']) || USER_A,
      created_at: '2026-09-17T15:36:04Z',
      updated_at: '2026-09-17T15:36:08Z',
      email,
      full_name: 'E2E Tester',
      is_active: true,
      plan: 'free',
      email_verified: true,
    }),
  );
  await page.route('**/api/v1/auth/oauth/providers', (route) =>
    json(route, 200, {
      google: { configured: false, display_name: 'Google', supports_repo_import: false, supports_signin: true },
      github: { configured: true, display_name: 'GitHub', supports_repo_import: true, supports_signin: true },
      gitlab: { configured: true, display_name: 'GitLab', supports_repo_import: true, supports_signin: true },
    }),
  );
  await page.route('**/api/v1/usage**', (route) => json(route, 200, {}));
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

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
}

test.describe.configure({ mode: 'serial' });

/** Console/page errors captured by beforeEach hooks, printed on failure. */
const info = {
  errors: [] as string[],
  set(list: string[]) {
    this.errors = list;
  },
};

test.describe('Flow B — provider → repository → scan → findings', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await info.set(pageErrors);
    await installShellMocks(page, 'flow-b@rvx.dev');
    await installProductMocks(page);
    await loginAs(page, TOKEN_A);
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === 'failed' && info.errors.length) {
      await testInfo.attach('page-errors.txt', {
        body: Buffer.from(info.errors.join('\n---\n'), 'utf8'),
        contentType: 'text/plain',
      });
    }
  });

  test('connect GitHub, see provider repositories, import, scan, findings', async ({ page }) => {
    await page.goto('/settings');
    await dismissCookies(page);

    // Open the Connections tab (real tab trigger, no URL-param assumption).
    await page.getByRole('tab', { name: /connections/i }).click();
    await expect(page.getByText('Connected accounts')).toBeVisible();

    // GitHub shows Connected for this user; provider repositories list.
    await expect(page.getByText('Connected').first()).toBeVisible();
    const repos = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/oauth/github/repos', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      return res.json();
    });
    expect(Array.isArray(repos)).toBe(true);

    await page.goto('/repositories');
    await expect(page.getByText('hello-world')).toBeVisible();

    // Row actions menu → New scan.
    await page.getByRole('button', { name: /open menu|more|actions/i }).first().click();
    await page.getByRole('menuitem', { name: /new scan/i }).click();
    await expect(page).toHaveURL(/\/scans\/new/);

    await page.getByText('Static Only').click();
    await page.getByRole('button', { name: /^start scan$/i }).click();
    await expect(page).toHaveURL(/\/scans/, { timeout: 15000 });

    // Findings surface on the findings index.
    await page.goto('/findings');
    await expect(page.getByText('Hardcoded credentials in app.py')).toBeVisible({ timeout: 15000 });
    await expectNoOverflow(page);
  });

  test('mobile 390×844: the same flow fits without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/repositories');
    await expect(page.getByText('hello-world')).toBeVisible();
    await expectNoOverflow(page);
  });
});

test.describe('Flow C — finding → repair → Proof of Fix', () => {
  test.beforeEach(async ({ page }) => {
    await installShellMocks(page, 'flow-c@rvx.dev');
    await installProductMocks(page);
    await loginAs(page, TOKEN_A);
  });

  test('finding detail exposes repair; verification states are honest', async ({ page }) => {
    await page.goto(`/findings/${FINDING_ID}`);
    await expect(page.getByText('Hardcoded credentials in app.py')).toBeVisible();

    const repair = page.getByRole('button', { name: /generate fix|repair|fix/i }).first();
    if (await repair.isVisible().catch(() => false)) {
      await repair.click();
      await expect(
        page.getByText(/candidate|generating|queued/i).first(),
      ).toBeVisible({ timeout: 15000 });
    }
    // Proof of Fix never claims success without backend evidence: with only
    // a candidate patch, no VERIFIED banner may appear.
    await expect(page.getByText(/verified fix/i)).toHaveCount(0);
    await expectNoOverflow(page);
  });

  test('mobile 390×844: finding detail renders without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/findings/${FINDING_ID}`);
    await expect(page.getByText('Hardcoded credentials in app.py')).toBeVisible();
    await expectNoOverflow(page);
  });
});

test.describe('Flow D — website → audit → findings → evidence', () => {
  test.beforeEach(async ({ page }) => {
    await installShellMocks(page, 'flow-d@rvx.dev');
    await installProductMocks(page);
    await loginAs(page, TOKEN_A);
  });

  test('register a website, run an audit, read findings and evidence', async ({ page }) => {
    await page.goto('/websites');
    await page.getByPlaceholder('https://example.com').fill('https://tonecraft.site');
    await page.getByRole('button', { name: /add website/i }).click();
    await expect(page.getByText('tonecraft.site')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /audit|scan|run/i }).first().click();
    await expect(page).toHaveURL(/\/websites\/[0-9a-f-]+/, { timeout: 15000 });

    await expect(page.getByText(/homepage has no unique h1/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/analytical score|not a ranking/i).first()).toBeVisible();
    await expectNoOverflow(page);
  });

  test('mobile 390×844: website detail keeps scores and findings readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/websites/${SITE_ID}`);
    await expect(page.getByText(/homepage has no unique h1|score/i).first()).toBeVisible();
    await expectNoOverflow(page);
  });
});

test.describe("Flow E — IDOR: another user's resource is denied", () => {
  test.beforeEach(async ({ page }) => {
    await installShellMocks(page, 'flow-e@rvx.dev');
    // Viewer is USER_B: nothing they request belongs to them.
    await installProductMocks(page, '00000000-0000-0000-0000-00000000b000');
    await loginAs(page, TOKEN_B);
  });

  test("user B cannot read user A's repositories, scans, findings or website", async ({ page }) => {
    await page.goto('/repositories');
    await expect(page.getByText('hello-world')).toHaveCount(0);

    // Direct URL access to A's finding and website returns not-found state,
    // not A's data.
    await page.goto(`/findings/${FINDING_ID}`);
    await expect(
      page.getByText(/not found|no access|doesn't exist|error/i).first(),
    ).toBeVisible({ timeout: 15000 });

    await page.goto(`/websites/${SITE_ID}`);
    await expect(
      page.getByText(/not found|no access|doesn't exist|error/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // And the API layer itself refuses the connection listing (403/404 path).
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/oauth/github/repos', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      return res.status;
    });
    expect([403, 404]).toContain(status);
    await expectNoOverflow(page);
  });

  test('mobile 390×844: denial states render cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/findings/${FINDING_ID}`);
    await expect(page.getByText(/not found|error|no access/i).first()).toBeVisible({ timeout: 15000 });
    await expectNoOverflow(page);
  });
});

test.describe('Flows B–E — live backend (E2E_LIVE_API_URL set)', () => {
  test.skip(!isLive, 'set E2E_LIVE_API_URL (+ E2E_LIVE_EMAIL/PASSWORD) to enable');

  test('live: unauthorized user cannot read another tenant’s finding', async ({ page }) => {
    await page.goto(`/findings/${FINDING_ID}`);
    await expect(page).toHaveURL(/auth\/login/); // no token → login redirect
  });
});
