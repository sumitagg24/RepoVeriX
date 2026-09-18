import type { Metadata } from 'next';

export const SITE = {
  name: 'RepoVeriX',
  tagline: 'Find code risks. Understand impact. Verify the fix.',
  description:
    'RepoVeriX audits whole repositories, grounds every finding in evidence you can read, and proves repairs by executing them in an isolated sandbox.',
  // Public origin used for canonical URLs, sitemap and social metadata.
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001').replace(/\/$/, ''),
} as const;

export function absoluteUrl(path = '/'): string {
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  /** Public pages index; authenticated and auth routes never do. */
  index?: boolean;
  keywords?: string[];
}

/** Single metadata builder so titles/descriptions/canonicals never drift. */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
  keywords,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      url,
      siteName: SITE.name,
      title: `${title} · ${SITE.name}`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE.name}`,
      description,
    },
  };
}

export const PUBLIC_NAV = [
  { href: '/product', label: 'Product' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/resources', label: 'Resources' },
  { href: '/docs', label: 'Docs' },
] as const;

export const FOOTER_NAV = [
  {
    title: 'Product',
    links: [
      { href: '/product', label: 'Platform overview' },
      { href: '/product#findings', label: 'Findings and evidence' },
      { href: '/product#verification', label: 'Verified repair' },
      { href: '/integrations', label: 'Integrations' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/docs', label: 'Documentation' },
      { href: '/docs/getting-started', label: 'Getting started' },
      { href: '/docs/api', label: 'API reference' },
      { href: '/docs/concepts', label: 'Evidence model' },
      { href: '/docs/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/auth/sign-in', label: 'Sign in' },
      { href: '/auth/sign-up', label: 'Create an account' },
      { href: '/dashboard', label: 'Workspace' },
      { href: '/billing', label: 'Billing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/resources#research', label: 'Research' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
] as const;

/** Routes that must never be indexed (mirrors robots.txt). */
export const PRIVATE_ROUTE_PREFIXES = [
  '/dashboard',
  '/repositories',
  '/scans',
  '/findings',
  '/rules',
  '/billing',
  '/settings',
  '/onboarding',
  '/help',
  '/team',
  '/auth',
] as const;
