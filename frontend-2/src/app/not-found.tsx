import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { Shell } from '@/components/layout/shell';
import { LogoMark } from '@/components/layout/logo';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/** The 404 lists real destinations instead of apologising and stopping. */
const SUGGESTIONS = [
  { href: '/product', label: 'Platform overview', hint: 'What RepoVeriX reads, finds and proves' },
  { href: '/docs', label: 'Documentation', hint: 'Getting started, evidence model, API reference' },
  { href: '/pricing', label: 'Pricing', hint: 'Repository, scan and verification limits per plan' },
  { href: '/dashboard', label: 'Workspace', hint: 'Repositories, scans and findings for your account' },
];

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center py-16">
      <Shell>
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-ink">
            <LogoMark className="text-accent" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">RepoVeriX</span>
          </div>
          <p className="mt-8 font-mono text-[12px] text-muted">404</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[38px]">
            This page does not exist
          </h1>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-body">
            The link may be from an older version of the product, or the page may have moved. Every
            route below is live and indexed.
          </p>

          <ul className="mt-8 divide-y divide-hairline border-y border-hairline">
            {SUGGESTIONS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:text-accent"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-ink">{item.label}</span>
                    <span className="block text-[13px] text-muted">{item.hint}</span>
                  </span>
                  <span aria-hidden="true" className="text-muted">
                    &rarr;
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/docs/getting-started">Read getting started</Link>
            </Button>
          </div>
        </div>
      </Shell>
    </main>
  );
}
