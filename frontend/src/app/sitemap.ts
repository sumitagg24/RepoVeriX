import type { MetadataRoute } from 'next';

import { BLOG_POSTS } from '@/lib/blog';
import { COMPARISONS } from '@/lib/seo/comparisons';
import { GLOSSARY_TERMS } from '@/lib/seo/glossary';
import { DETECTION_RULES } from '@/lib/seo/rules';
import { SAMPLE_REPOS } from '@/lib/seo/repos';
import { VULNERABILITY_CLASSES } from '@/lib/seo/vulnerabilities';
import { SITE_URL } from '@/lib/site-url';

/**
 * Public marketing/docs sitemap. App pages (dashboard, repositories, scans,
 * findings, billing, settings), auth pages and share links are intentionally
 * excluded — they are either private or per-user and must never be indexed
 * (see robots.ts for the complementary allow/deny rules, and middleware.ts for
 * the `X-Robots-Tag: noindex` header those private routes also carry).
 *
 * Detail pages are generated from the typed registries so adding an entry
 * (a rule, glossary term, comparison…) lands in the sitemap automatically.
 * Only pages without a registry are hand-listed here.
 *
 * Accuracy rules (claude-seo/skills/seo-sitemap):
 *  - `<priority>` and `<changefreq>` are omitted. Google documents both as
 *    ignored ranking/recrawl signals, so emitting hand-tuned numbers for 100+
 *    URLs is noise that only invites the reader to trust numbers that do
 *    nothing.
 *  - `<lastmod>` is emitted only where a real content date exists (blog posts).
 *    The previous version stamped `new Date()` on every URL, which made the
 *    whole sitemap claim it changed on every single request — the one pattern
 *    Google explicitly says causes it to stop trusting lastmod entirely. For
 *    registry pages with no date field, omitting lastmod is correct; inventing
 *    one is not.
 */

/** A sitemap entry. `lastModified` is omitted rather than fabricated. */
const page = (path: string, lastModified?: string) => ({
  url: `${SITE_URL}${path}`,
  ...(lastModified ? { lastModified } : {}),
});

/** Documentation pages. Hand-listed: they have no registry. */
const DOCS_PAGES = [
  '/docs',
  '/docs/getting-started',
  '/docs/concepts',
  '/docs/features',
  '/docs/configuration',
  '/docs/api',
  '/docs/research',
  '/docs/faq',
  '/docs/account-security',
];

/** Support/help pages. Hand-listed: they have no registry. */
const HELP_PAGES = [
  '/help',
  '/help/get-started',
  '/help/features',
  '/help/api',
  '/help/billing',
  '/help/security',
  '/help/troubleshooting',
  '/help/contact',
  '/help/community',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Core pages (no registry)
    page('/'),
    page('/tools'), // public tool catalog — was missing entirely
    page('/changelog'),

    // Documentation
    ...DOCS_PAGES.map((path) => page(path)),

    // Support
    ...HELP_PAGES.map((path) => page(path)),

    // Blog — the only section with real content dates, so the only section
    // that carries lastmod.
    page('/blog'),
    ...BLOG_POSTS.map((p) => page(`/blog/${p.slug}`, p.date)),

    // Vulnerability-class knowledge base (programmatic SEO)
    page('/vulnerabilities'),
    ...VULNERABILITY_CLASSES.map((v) => page(`/vulnerabilities/${v.slug}`)),

    // Detection-rule reference
    page('/detections'),
    ...DETECTION_RULES.map((r) => page(`/detections/${r.slug}`)),

    // Sample fixture repositories
    page('/vulnerable-repos'),
    ...SAMPLE_REPOS.map((r) => page(`/vulnerable-repos/${r.slug}`)),

    // Glossary (DefinedTermSet)
    page('/glossary'),
    ...GLOSSARY_TERMS.map((t) => page(`/glossary/${t.slug}`)),

    // Comparisons (commercial intent)
    page('/compare'),
    ...COMPARISONS.map((c) => page(`/compare/${c.slug}`)),

    // Integrations
    page('/integrations/github'),
    page('/integrations/gitlab'),

    // Legal
    page('/privacy'),
    page('/terms'),
  ];
}
