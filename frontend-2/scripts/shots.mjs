/**
 * Temporary review harness: screenshots routes at real viewports so the layout
 * can be inspected rather than guessed at. Playwright is resolved from the
 * sibling legacy frontend install so frontend-2 adds no test dependency.
 *
 *   MSYS_NO_PATHCONV=1 TOKEN=... ROUTES="/,/pricing" node frontend-2/scripts/shots.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const require = createRequire(resolve(repoRoot, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const OUT = process.env.SHOT_DIR ?? 'C:/Users/Sumit/AppData/Local/Temp/fe2-shots';
const TOKEN = process.env.TOKEN ?? '';
const ROUTES = (process.env.ROUTES ?? '/').split(',');
const WIDTHS = (process.env.WIDTHS ?? '1512x950,390x844')
  .split(',')
  .map((pair) => pair.split('x').map(Number));
const FULL = process.env.FULL !== 'off';
const DARK = process.env.DARK === '1';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [width, height] of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: DARK ? 'dark' : 'light',
  });
  if (TOKEN) {
    await context.addInitScript((token) => {
      window.localStorage.setItem('repoverix.access_token', token);
    }, TOKEN);
  }
  for (const route of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 200)}`));
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1400);
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    } catch (error) {
      errors.push(`navigation: ${String(error).slice(0, 160)}`);
    }
    const name = `${route.replace(/[^a-z0-9]+/gi, '_') || 'root'}_${width}${DARK ? '_dark' : ''}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: FULL }).catch(() => {});
    const overflow = await page
      .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      .catch(() => null);
    console.log(
      `${route.padEnd(34)} ${String(width).padEnd(5)} overflow=${String(overflow).padEnd(5)} errors=${errors.length ? errors.join(' | ') : 'none'}`,
    );
    await page.close();
  }
  await context.close();
}
await browser.close();
console.log(`shots: ${OUT}`);
