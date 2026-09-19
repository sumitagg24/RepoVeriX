import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/site';

/**
 * Dynamic sitemap served at /sitemap.xml.
 *
 * Only public marketing and doc pages are included. Authenticated app routes
 * (/dashboard, /repositories, /scans, /findings, /settings, /auth) are kept
 * out of the index by the corresponding robots.ts disallow list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    // Homepage
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },

    // Core marketing pages
    {
      url: absoluteUrl('/product'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/solutions'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/integrations'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/pricing'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/resources'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },

    // Documentation
    {
      url: absoluteUrl('/docs'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/docs/getting-started'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/docs/api'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/docs/concepts'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/docs/faq'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // Legal
    {
      url: absoluteUrl('/privacy'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/terms'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  return pages;
}
