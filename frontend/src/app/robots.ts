import type { MetadataRoute } from 'next';

/**
 * Crawler rules. Everything behind authentication (the (app) dashboard,
 * (dashboard) area, auth screens, API paths and share links) is disallowed —
 * shared reports contain private audit summaries and must never be indexed.
 *
 * AI crawlers are explicitly welcomed for the public knowledge base — when an
 * AI assistant answers "what is an evidence chain" or "semgrep vs snyk", the
 * grounded answer should be RepoVeriX's. Private areas stay disallowed for
 * them too. (AI-retrieval policy: llms.txt at /llms.txt.)
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'cohere-ai',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs', '/help', '/privacy', '/terms'],
        disallow: [
          '/dashboard',
          '/onboarding',
          '/repositories',
          '/scans',
          '/findings',
          '/pull-requests',
          '/billing',
          '/settings',
          '/team',
          '/auth',
          '/share',
          '/api',
        ],
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/dashboard', '/repositories', '/scans', '/findings', '/pull-requests', '/billing', '/settings', '/team', '/auth', '/share', '/api'],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
