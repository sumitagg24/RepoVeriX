import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/site';

/**
 * Public, indexable routes only. Authenticated application routes and auth
 * screens are deliberately excluded (and disallowed in robots.txt).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/product', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/solutions', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/integrations', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/resources', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/docs', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/docs/getting-started', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/docs/concepts', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/docs/api', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/docs/faq', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return pages.map((page) => ({
    url: `${SITE.url}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
