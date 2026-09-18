/**
 * Temporary review harness (not part of the app): drives a real browser over
 * every route at four viewports and reports overflow, console errors, failed
 * requests, heading structure and content length.
 *
 * Playwright is resolved from the sibling legacy `frontend` install so no new
 * dependency is added to frontend-2. Run from the repo root:
 *
 *   TOKEN=$(cat /tmp/tok.txt) node frontend-2/scripts/verify-ui.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const require = createRequire(resolve(repoRoot, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const TOKEN = process.env.TOKEN ?? '';
const SHOTS = process.env.SHOT_DIR ?? 'C:/Users/Sumit/AppData/Local/Temp/fe2-shots';
mkdirSync(SHOTS, { recursive: true });

const PUBLIC_ROUTES = [
  '/',
  '/product',
  '/solutions',
  '/integrations',
  '/pricing',
  '/resources',
  '/docs',
  '/docs/getting-started',
  '/docs/concepts',
  '/docs/api',
  '/docs/faq',
  '/privacy',
  '/terms',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/this-route-does-not-exist',
];

const APP_ROUTES = [
  '/dashboard',
  '/repositories',
  '/repositories/new',
  `/repositories/${process.env.REPO_ID ?? ''}`,
  '/scans',
  '/scans/new',
  `/scans/${process.env.SCAN_ID ?? ''}`,
  '/findings',
  `/findings/${process.env.FINDING_ID ?? ''}`,
  '/rules',
  '/rules/rvx-sqli-001',
  '/rules/not-a-real-rule',
  '/billing',
  '/settings',
  '/settings/security',
  '/settings/integrations',
  '/settings/team',
  '/onboarding',
  '/help',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1512, height: 950 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

// Every route on desktop + mobile; the middle breakpoints on a representative
// subset so the sweep stays quick.
const MID_VIEWPORT_ROUTES = new Set([
  '/',
  '/pricing',
  '/docs/getting-started',
  '/dashboard',
  '/repositories',
  '/findings',
  '/scans',
  '/billing',
]);

async function sweep(context, viewport, routes, signedIn) {
  const results = [];
  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 300)));
    page.on('response', (res) => {
      if (res.status() >= 400 && !route.includes('this-route-does-not-exist')) {
        failedRequests.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`);
      }
    });

    let status = 0;
    let title = '';
    try {
      const response = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      status = response?.status() ?? 0;
      await page.waitForTimeout(1200);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      title = await page.title();
    } catch (error) {
      pageErrors.push(`navigation: ${String(error).slice(0, 200)}`);
    }

    const probe = await page
      .evaluate(() => {
        const doc = document.documentElement;
        const main = document.querySelector('main') ?? document.body;
        const overflowing = [];
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right > window.innerWidth + 1 || rect.left < -1) {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'absolute') continue;
            overflowing.push(
              `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} w=${Math.round(rect.width)} right=${Math.round(rect.right)}`,
            );
          }
        }
        const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(
          (h) => `${h.tagName}:${(h.textContent ?? '').trim().slice(0, 48)}`,
        );
        const unlabelledControls = Array.from(
          document.querySelectorAll('button, a[href], input, select, textarea'),
        ).filter((el) => {
          const text = (el.textContent ?? '').trim();
          const aria = el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby') ?? '';
          const title = el.getAttribute('title') ?? '';
          const alt = el.querySelector('img[alt]')?.getAttribute('alt') ?? '';
          const labelled = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
          return !text && !aria && !title && !alt && !labelled;
        }).length;
        return {
          docWidth: doc.scrollWidth,
          viewportWidth: window.innerWidth,
          bodyTextLength: (main.textContent ?? '').trim().length,
          h1: document.querySelectorAll('h1').length,
          headings: headings.slice(0, 12),
          overflowing: overflowing.slice(0, 6),
          unlabelledControls,
          mainPresent: Boolean(document.querySelector('main')),
        };
      })
      .catch(() => null);

    if (process.env.SHOTS !== 'off' && (viewport.name === 'desktop' || viewport.name === 'mobile')) {
      const file = `${SHOTS}/${route.replace(/[^a-z0-9]+/gi, '_') || 'root'}_${viewport.name}.png`;
      await page.screenshot({ path: file }).catch(() => {});
      writeFileSync(`${file}.txt`, JSON.stringify({ probe, title, status }, null, 2));
    }

    results.push({
      route,
      viewport: viewport.name,
      signedIn,
      status,
      title,
      overflow: probe ? Math.max(0, probe.docWidth - probe.viewportWidth) : -1,
      textLen: probe?.bodyTextLength ?? 0,
      h1: probe?.h1 ?? 0,
      headings: probe?.headings ?? [],
      overflowing: probe?.overflowing ?? [],
      unlabelled: probe?.unlabelledControls ?? -1,
      consoleErrors,
      pageErrors,
      failedRequests,
    });
    await page.close();
  }
  return results;
}

const browser = await chromium.launch();
const all = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (TOKEN) {
    await context.addInitScript((token) => {
      window.localStorage.setItem('repoverix.access_token', token);
    }, TOKEN);
  }
  const routes =
    viewport.name === 'desktop' || viewport.name === 'mobile'
      ? [...PUBLIC_ROUTES, ...APP_ROUTES]
      : [...PUBLIC_ROUTES.filter((r) => MID_VIEWPORT_ROUTES.has(r)), ...APP_ROUTES.filter((r) => MID_VIEWPORT_ROUTES.has(r))];
  all.push(...(await sweep(context, viewport, routes, Boolean(TOKEN))));
  await context.close();
}

await browser.close();

const problems = [];
for (const r of all) {
  const flags = [];
  if (r.status !== 200) flags.push(`status ${r.status}`);
  if (r.overflow > 2) flags.push(`h-overflow ${r.overflow}px`);
  if (r.overflowing.length) flags.push(`offenders: ${r.overflowing.join(' | ')}`);
  if (r.pageErrors.length) flags.push(`pageerror: ${r.pageErrors.join(' | ')}`);
  if (r.consoleErrors.some((e) => !/401|Failed to load resource/.test(e))) flags.push(`console: ${r.consoleErrors.join(' | ')}`);
  if (r.textLen < 400) flags.push(`thin content ${r.textLen}`);
  if (r.h1 > 1) flags.push(`${r.h1} h1 elements`);
  if (r.unlabelled > 0) flags.push(`${r.unlabelled} controls without accessible name`);
  const noisy = r.failedRequests.filter((f) => !/401 /.test(f));
  if (noisy.length) flags.push(`http: ${noisy.join(', ')}`);
  if (flags.length) problems.push(`${r.viewport} ${r.route} → ${flags.join(' ; ')}`);
}

console.log(`checked ${all.length} route/viewport combinations`);
console.log('--- problems ---');
console.log(problems.length ? problems.join('\n') : 'none');
console.log('--- route × viewport summary ---');
for (const r of all) {
  console.log(
    `${r.viewport.padEnd(8)} ${String(r.status).padEnd(4)} ovf=${String(r.overflow).padEnd(4)} text=${String(r.textLen).padEnd(6)} h1=${r.h1} ${r.route}`,
  );
}
writeFileSync(`${SHOTS}/report.json`, JSON.stringify(all, null, 2));
console.log(`report: ${SHOTS}/report.json`);
