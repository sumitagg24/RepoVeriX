import type { MetadataRoute } from 'next';

import { PRIVATE_ROUTE_PREFIXES, SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Both the bare route and everything beneath it.
        disallow: PRIVATE_ROUTE_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/`]),
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
