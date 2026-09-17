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
 * (see robots.ts for the complementary rules).
 *
 * Detail pages are generated from the typed registries so adding an entry
 * (a rule, glossary term, comparison…) lands in the sitemap automatically.
 * Only pages without a registry are hand-listed here.
 */
const now = new Date();

const page = (path: string, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'], priority: number) => ({
  url: `${SITE_URL}${path}`,
  lastModified: now,
  changeFrequency,
  priority,
});

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Core pages (no registry)
    page('/', 'weekly', 1),
    page('/docs', 'weekly', 0.8),
    page('/docs/account-security', 'monthly', 0.6),
    page('/help', 'weekly', 0.7),
    page('/blog', 'weekly', 0.7),
    ...BLOG_POSTS.map((p) => page(`/blog/${p.slug}`, 'yearly', 0.6)),
    page('/changelog', 'weekly', 0.6),

    // Vulnerability-class knowledge base (programmatic SEO)
    page('/vulnerabilities', 'weekly', 0.8),
    ...VULNERABILITY_CLASSES.map((v) => page(`/vulnerabilities/${v.slug}`, 'monthly', 0.7)),

    // Detection-rule reference
    page('/detections', 'weekly', 0.8),
    ...DETECTION_RULES.map((r) => page(`/detections/${r.slug}`, 'monthly', 0.6)),

    // Sample fixture repositories
    page('/vulnerable-repos', 'monthly', 0.7),
    ...SAMPLE_REPOS.map((r) => page(`/vulnerable-repos/${r.slug}`, 'monthly', 0.6)),

    // Glossary (DefinedTermSet)
    page('/glossary', 'monthly', 0.7),
    ...GLOSSARY_TERMS.map((t) => page(`/glossary/${t.slug}`, 'monthly', 0.6)),

    // Comparisons (commercial intent)
    page('/compare', 'monthly', 0.8),
    ...COMPARISONS.map((c) => page(`/compare/${c.slug}`, 'monthly', 0.7)),

    // Static marketing / help pages (no registry)
    page('/integrations/github', 'monthly', 0.7),
    page('/integrations/gitlab', 'monthly', 0.7),
    page('/help/get-started', 'monthly', 0.6),
    page('/help/features', 'monthly', 0.6),
    page('/help/api', 'monthly', 0.6),
    page('/help/billing', 'monthly', 0.6),
    page('/help/security', 'monthly', 0.6),
    page('/help/troubleshooting', 'monthly', 0.5),
    page('/help/contact', 'monthly', 0.5),
    page('/help/community', 'monthly', 0.4),
    page('/privacy', 'yearly', 0.3),
    page('/terms', 'yearly', 0.3),
  ];
}
