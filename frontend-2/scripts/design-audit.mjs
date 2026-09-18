/**
 * Temporary design audit harness.
 *
 * Design quality is verified numerically here: contrast ratios, radius
 * consistency, hero fit inside the first viewport, single-line navigation, the
 * eyebrow budget, button label wrapping and tap-target sizes. Everything runs in
 * the real browser against the running dev server.
 *
 *   MSYS_NO_PATHCONV=1 TOKEN=... ROUTES="/,/pricing" node frontend-2/scripts/design-audit.mjs
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const require = createRequire(resolve(repoRoot, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const TOKEN = process.env.TOKEN ?? '';
const ROUTES = (process.env.ROUTES ?? '/').split(',');
const WIDTHS = (process.env.WIDTHS ?? '1512x950,390x844').split(',').map((p) => p.split('x').map(Number));

const AUDIT = () => {
  const parseColor = (value) => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const backgroundOf = (element) => {
    let node = element;
    while (node && node !== document.documentElement) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.5) return bg;
      node = node.parentElement;
    }
    return parseColor(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  };

  const contrast = (element) => {
    const fg = parseColor(getComputedStyle(element).color);
    if (!fg) return null;
    const bg = backgroundOf(element);
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return Math.round(ratio * 100) / 100;
  };

  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0';
  };

  const sample = (selector, limit = 40) =>
    Array.from(document.querySelectorAll(selector)).filter(visible).slice(0, limit);

  const textSamples = [
    { name: 'heading', selector: 'h1, h2' },
    { name: 'body copy', selector: 'p.text-body, p' },
    { name: 'muted text', selector: '.text-muted, p.text-muted, .caption' },
    { name: 'faint text', selector: '.text-faint, .text-faint *' },
    { name: 'accent link', selector: 'a.text-accent, .text-accent' },
    { name: 'nav item', selector: 'header nav a' },
    { name: 'table cell', selector: 'td' },
    { name: 'chip', selector: '.chip' },
  ];

  const contrastReport = {};
  const offenders = [];
  for (const { name, selector } of textSamples) {
    const nodes = sample(selector, 12);
    if (!nodes.length) continue;
    const measured = nodes
      .map((node) => ({ node, ratio: contrast(node), size: parseFloat(getComputedStyle(node).fontSize) }))
      .filter((entry) => entry.ratio != null);
    const ratios = measured.map((entry) => entry.ratio);
    const sizes = measured.map((entry) => entry.size);
    contrastReport[name] = {
      min: Math.min(...ratios),
      median: ratios.sort((a, b) => a - b)[Math.round(ratios.length / 2) - 1],
      minFontPx: Math.min(...sizes),
      count: ratios.length,
    };
    measured
      .filter((entry) => entry.ratio < (entry.size >= 18 ? 3 : 4.5))
      .slice(0, 3)
      .forEach((entry) => {
        offenders.push({
          group: name,
          ratio: entry.ratio,
          size: entry.size,
          color: getComputedStyle(entry.node).color,
          bg: (() => {
            const bg = backgroundOf(entry.node);
            return `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
          })(),
          text: (entry.node.textContent ?? '').trim().slice(0, 46),
          cls: String(entry.node.className).slice(0, 60),
        });
      });
  }

  const radii = {};
  let radiusMismatch = 0;
  for (const element of sample('button, input, select, .panel, .chip, .code-surface, a[href].inline-flex, a[href][class*="rounded"]', 400)) {
    const raw = getComputedStyle(element).borderRadius.split(' ')[0];
    const px = Math.round(parseFloat(raw));
    radii[px] = (radii[px] ?? 0) + 1;
    if (![0, 4, 6, 8, 10, 12, 999].includes(px)) radiusMismatch += 1;
  }

  const fonts = new Set();
  for (const element of sample('h1, h2, p, code, .font-mono, .chip', 120)) {
    const family = getComputedStyle(element).fontFamily;
    fonts.add(family.includes('GeistSans') ? 'sans' : family.includes('GeistMono') ? 'mono' : `other:${family.slice(0, 30)}`);
  }

  const header = document.querySelector('header');
  const headerHeight = header ? Math.round(header.getBoundingClientRect().height) : null;
  const navItems = sample('header nav a', 12).map((a) => Math.round(a.getBoundingClientRect().top));
  const navSingleLine = navItems.length ? new Set(navItems).size === 1 : null;

  const hero = document.querySelector('main > section:first-child, main section:first-child');
  const heroBottom = hero ? Math.round(hero.getBoundingClientRect().bottom) : null;
  const heroHeadingLines = (() => {
    const heading = document.querySelector('main h1');
    if (!heading) return null;
    const style = getComputedStyle(heading);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    return Math.round(heading.getBoundingClientRect().height / lineHeight);
  })();
  const firstCtaBottom = (() => {
    const link = document.querySelector('main a[href="/auth/sign-up"]');
    return link ? Math.round(link.getBoundingClientRect().bottom) : null;
  })();

  const eyebrowCount = sample('.caption-upper', 60).length;
  const sectionCount = document.querySelectorAll('main section').length;

  const wrappedButtons = sample('button, a[href]', 200)
    .filter((element) => element.getBoundingClientRect().width > 2)
    .filter((element) => element.scrollWidth > element.clientWidth + 2 && element.clientWidth > 0)
    .map((element) => (element.textContent ?? '').trim().slice(0, 40));

  // WCAG 2.5.8 exempts inline links inside a sentence; this checks the controls
  // that are standalone targets: buttons, switches and icon-only links.
  const smallTargets = sample('button, [role="switch"], a[href][aria-label]', 400)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 24 || rect.height < 24;
    })
    .map((element) => (element.textContent ?? element.getAttribute('aria-label') ?? element.tagName).trim().slice(0, 40));

  const emptyInteractive = Array.from(document.querySelectorAll('button, a[href]')).filter((element) => {
    if (!visible(element)) return false;
    const text = (element.textContent ?? '').trim();
    const label = element.getAttribute('aria-label') ?? element.getAttribute('title') ?? '';
    return !text && !label;
  }).length;

  return {
    contrastReport,
    radii,
    radiusMismatch,
    fonts: Array.from(fonts),
    headerHeight,
    navSingleLine,
    heroBottom,
    heroHeadingLines,
    firstCtaBottom,
    viewportHeight: window.innerHeight,
    eyebrowCount,
    sectionCount,
    wrappedButtons: wrappedButtons.slice(0, 6),
    smallTargets: smallTargets.slice(0, 8),
    emptyInteractive,
    offenders,
    docOverflow: document.documentElement.scrollWidth - window.innerWidth,
  };
};

const browser = await chromium.launch();
const failures = [];

for (const [width, height] of WIDTHS) {
  for (const dark of [false, true]) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: dark ? 'dark' : 'light',
    });
    if (TOKEN) {
      await context.addInitScript((token) => {
        window.localStorage.setItem('repoverix.access_token', token);
      }, TOKEN);
    }
    for (const route of ROUTES) {
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 160));
      });
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 160)}`));
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      const report = await page.evaluate(AUDIT);

      const label = `${route} @${width}${dark ? ' dark' : ''}`;
      const notes = [];
      for (const [name, entry] of Object.entries(report.contrastReport)) {
        const threshold = entry.minFontPx >= 18 ? 3 : 4.5;
        if (entry.min < threshold) notes.push(`contrast ${name} ${entry.min}:1 < ${threshold} (${entry.minFontPx}px)`);
      }
      if (report.radiusMismatch) notes.push(`${report.radiusMismatch} elements outside the radius scale`);
      if (report.fonts.some((f) => f.startsWith('other'))) notes.push(`unexpected fonts: ${report.fonts.join(', ')}`);
      if (report.headerHeight != null && report.headerHeight > 80) notes.push(`header ${report.headerHeight}px > 80px`);
      if (report.navSingleLine === false) notes.push('desktop nav wraps to more than one line');
      // Above 1024px the hero must resolve inside the first viewport so the next
      // section peeks in. On phones the copy, CTAs and preview stack, which is
      // expected as long as the CTA stays above the fold (checked below).
      if (width >= 1024 && report.heroBottom != null && report.heroBottom > height + 8)
        notes.push(`hero ends at ${report.heroBottom}px, past the ${height}px viewport`);
      if (report.firstCtaBottom != null && report.firstCtaBottom > height)
        notes.push(`first CTA bottom ${report.firstCtaBottom}px is below the fold`);
      if (report.heroHeadingLines != null && report.heroHeadingLines > 2)
        notes.push(`hero headline is ${report.heroHeadingLines} lines`);
      if (report.eyebrowCount > Math.ceil(report.sectionCount / 3))
        notes.push(`eyebrow budget: ${report.eyebrowCount} eyebrows over ${report.sectionCount} sections`);
      if (report.wrappedButtons.length) notes.push(`clipped/wrapped labels: ${report.wrappedButtons.join(' | ')}`);
      if (report.smallTargets.length) notes.push(`tap targets under 24px: ${report.smallTargets.join(' | ')}`);
      if (report.emptyInteractive) notes.push(`${report.emptyInteractive} controls without an accessible name`);
      if (report.docOverflow > 2) notes.push(`horizontal overflow ${report.docOverflow}px`);
      if (consoleErrors.length) notes.push(`console: ${consoleErrors.join(' | ')}`);

      const contrastSummary = Object.entries(report.contrastReport)
        .map(([name, entry]) => `${name}=${entry.min}`)
        .join(' ');
      console.log(`\n${label}\n  contrast(min): ${contrastSummary}`);
      for (const offender of report.offenders.slice(0, 6)) {
        console.log(
          `    offender ${offender.group}: ${offender.ratio}:1 @${offender.size}px color=${offender.color} bg=${offender.bg} "${offender.text}" .${offender.cls}`,
        );
      }
      console.log(`  radii: ${JSON.stringify(report.radii)}  header=${report.headerHeight}px  sections=${report.sectionCount}  eyebrows=${report.eyebrowCount}`);
      console.log(`  hero: bottom=${report.heroBottom} of ${height}  headline=${report.heroHeadingLines} lines  cta=${report.firstCtaBottom}`);
      if (notes.length) {
        console.log(`  ISSUES:\n${notes.map((n) => `    - ${n}`).join('\n')}`);
        failures.push(`${label}: ${notes.join('; ')}`);
      } else {
        console.log('  no issues');
      }
      await page.close();
    }
    await context.close();
  }
}

await browser.close();
console.log(`\n=== ${failures.length} audit failures ===`);
for (const failure of failures) console.log(`- ${failure}`);
