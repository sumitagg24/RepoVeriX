'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Shell } from '@/components/layout/shell';
import { cn } from '@/lib/utils';

const DOCS_NAV = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/getting-started', label: 'Getting started' },
  { href: '/docs/concepts', label: 'Evidence model' },
  { href: '/docs/api', label: 'API reference' },
  { href: '/docs/faq', label: 'FAQ' },
] as const;

/** Documentation shell: section nav on the left, reading column on the right. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Shell width="wide" className="py-12 sm:py-16">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="Documentation" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[12px] font-medium text-muted">Documentation</p>
          <ul className="mt-3 space-y-0.5 lg:border-l lg:border-hairline">
            {DOCS_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-3 py-2 text-[13.5px] transition-colors lg:rounded-none lg:border-l-2 lg:px-4',
                      active
                        ? 'bg-surface font-medium text-ink lg:border-accent lg:bg-transparent'
                        : 'text-body hover:bg-surface hover:text-ink lg:border-transparent',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </Shell>
  );
}
