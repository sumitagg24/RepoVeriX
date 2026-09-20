import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { Providers } from './providers';
import { CookieConsent } from '@/components/layout/cookie-consent';
import { SITE, absoluteUrl } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name}: repository security that proves the fix`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  icons: { icon: '/icon.svg' },
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    type: 'website',
    url: absoluteUrl('/'),
    siteName: SITE.name,
    title: `${SITE.name}: repository security that proves the fix`,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name}: repository security that proves the fix`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#151310' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Three entities are described, and only these are claimed: the organisation,
 * the website, and the product as a software application. Pricing is described
 * as a range because the plan catalogue is authoritative in the API, not here.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': absoluteUrl('/#organization'),
      name: SITE.name,
      url: absoluteUrl('/'),
      description: SITE.description,
    },
    {
      '@type': 'WebSite',
      '@id': absoluteUrl('/#website'),
      name: SITE.name,
      url: absoluteUrl('/'),
      publisher: { '@id': absoluteUrl('/#organization') },
    },
    {
      '@type': 'SoftwareApplication',
      name: SITE.name,
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Web',
      description:
        'Repository security analysis that records an evidence chain for every finding and verifies candidate repairs in an isolated sandbox.',
      url: absoluteUrl('/'),
      featureList: [
        'Static detectors for injected queries, shell execution, hardcoded secrets and weak hashing',
        'Evidence chains: source, transformation, sink, with file and line context',
        'Sandboxed verification of candidate repairs',
        'SARIF, Markdown and JSON exports',
      ],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free plan with 3 repositories and 5 scans per month',
      },
    },
  ],
};

/**
 * Applied before paint so the first frame is already in the right theme —
 * no flash of a light shell for someone who chose dark.
 */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('repoverix.theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-md border border-hairline bg-card px-3 py-2 text-sm font-medium shadow-raised"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  );
}
