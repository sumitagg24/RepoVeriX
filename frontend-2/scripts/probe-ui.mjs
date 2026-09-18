/** Temporary: print exact offending DOM for a route + viewport (review aid). */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '..', '..', 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const TOKEN = process.env.TOKEN ?? '';
const width = Number(process.env.WIDTH ?? 390);
const targets = (process.env.ROUTES ?? '/').split(',');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height: 900 } });
await context.addInitScript((token) => {
  window.localStorage.setItem('repoverix.access_token', token);
}, TOKEN);

for (const route of targets) {
  const page = await context.newPage();
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const report = await page.evaluate(() => {
    const out = { doc: document.documentElement.scrollWidth, win: window.innerWidth, offenders: [], unnamed: [], chains: [] };
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > window.innerWidth + 1) {
        const chain = [];
        let node = el;
        while (node && node !== document.body) {
          const style = getComputedStyle(node);
          chain.push(
            `${node.tagName.toLowerCase()}.${String(node.className).split(' ').slice(0, 2).join('.')}[${style.overflowX}]`,
          );
          node = node.parentElement;
        }
        out.offenders.push({
          html: el.outerHTML.slice(0, 220),
          width: Math.round(rect.width),
          right: Math.round(rect.right),
          chain: chain.join(' < '),
        });
      }
    }
    for (const el of Array.from(document.querySelectorAll('button, a[href], input, select, textarea'))) {
      const text = (el.textContent ?? '').trim();
      const aria = el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby') ?? '';
      const title = el.getAttribute('title') ?? '';
      const labelled =
        (el.id ? document.querySelector(`label[for="${el.id}"]`) : null) ?? el.closest('label');
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (!text && !aria && !title && !labelled) out.unnamed.push(el.outerHTML.slice(0, 220));
    }
    out.offenders = out.offenders.slice(0, 5);
    out.unnamed = out.unnamed.slice(0, 8);
    return out;
  });
  const widths = await page.evaluate(() =>
    Array.from(document.querySelectorAll('section, section > div, section > div.grid, section > div.grid > div, figure')).map((el) => ({
      tag: `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`,
      w: Math.round(el.getBoundingClientRect().width),
      sw: el.scrollWidth,
    })),
  );
  console.log(`\n=== ${route} @${width} === doc=${report.doc} win=${report.win}`);
  if (process.env.WIDTHS === '1') {
    for (const w of widths.filter((x) => x.w > width - 2)) console.log(`  wide: ${w.tag} w=${w.w} scrollW=${w.sw}`);
  }
  if (process.env.PRINT_TEXT) {
    const text = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
    console.log(text.slice(0, Number(process.env.PRINT_TEXT)).replace(/\n{2,}/g, '\n'));
  }
  for (const o of report.offenders) console.log(`  off w=${o.width} right=${o.right}\n     ${o.html}\n     chain: ${o.chain}`);
  for (const u of report.unnamed) console.log(`  unnamed: ${u}`);
  await page.close();
}

await browser.close();
