import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { CookieConsent } from '@/components/cookie-consent';
import { getNonce } from '@/lib/csp-server';
import { SITE_URL } from '@/lib/site-url';

/* Font system — all self-hosted at build time (no runtime CDN requests).
 *  - Inter      : UI / body copy
 *  - Fraunces   : display / hero headings (warm editorial serif, optical sizing)
 *  - JetBrains  : code, diffs, identifiers
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'RepoVeriX - Repository Auditing & Automated Repair',
    template: '%s - RepoVeriX',
  },
  description:
    'Evidence-grounded repository auditing and verified automated repair. Every finding carries a proof chain; every fix is certified by running your tests in a sandbox.',
  applicationName: 'RepoVeriX',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'RepoVeriX',
    url: SITE_URL,
    title: 'RepoVeriX - Repository Auditing & Automated Repair',
    description:
      'Evidence-grounded repository auditing and verified automated repair. LLM proposes, evidence supports, execution verifies.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RepoVeriX - Repository Auditing & Automated Repair',
    description:
      'Evidence-grounded repository auditing and verified automated repair.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#171310' },
  ],
};

/** Pre-paint theme bootstrap: apply the stored/system theme before first paint
 *  so there is never a flash of the wrong scheme. Keep in sync with
 *  readTheme() in ThemeProvider. */
const themeScript = `(function(){try{var k='repoverix-theme';var t=localStorage.getItem(k);if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var d=document.documentElement;if(t==='dark'){d.classList.add('dark');}else{d.classList.add('light');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-request nonce from src/middleware.ts — required for the strict
  // script-src CSP; without it inline scripts are blocked in production.
  const nonce = getNonce();
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inter.variable} ${fraunces.variable} ${jetbrains.variable} antialiased`}
      >
        {/* suppressHydrationWarning: Fast Refresh re-renders cannot read
            request headers, so React diffs the nonce prop against the DOM and
            warns in dev. The attribute is correct at parse time, which is all
            CSP enforcement needs. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
 />
        {/* Structured data: Organization + SoftwareApplication. FAQPage JSON-LD
            is rendered by the landing page next to the actual FAQ content. */}
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'RepoVeriX',
                url: SITE_URL,
                logo: `${SITE_URL}/icon.svg`,
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'RepoVeriX',
                url: SITE_URL,
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${SITE_URL}/help?q={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
              {
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'RepoVeriX',
                applicationCategory: 'DeveloperApplication',
                operatingSystem: 'Web',
                url: SITE_URL,
                description:
                  'Evidence-grounded repository auditing and verified automated repair platform.',
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                },
              },
            ]),
          }}
        />
        <Providers>{children}</Providers>
        <CookieConsent />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
