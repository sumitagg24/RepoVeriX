'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const groups: { title: string; links: { name: string; href: string }[] }[] = [
  {
    title: 'Getting started',
    links: [
      { name: 'Overview', href: '/docs' },
      { name: 'Quick start', href: '/docs/getting-started' },
      { name: 'Concepts & evidence', href: '/docs/concepts' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { name: 'Feature guide', href: '/docs/features' },
      { name: 'Configuration & keys', href: '/docs/configuration' },
      { name: 'API reference', href: '/docs/api' },
    ],
  },
  {
    title: 'Research & help',
    links: [
      { name: 'RepoVeriX-Bench', href: '/docs/research' },
      { name: 'FAQ', href: '/docs/faq' },
    ],
  },
];

const flat = groups.flatMap((group) => group.links);

export function DocsNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === '/docs' ? pathname === '/docs' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Documentation">
        {flat.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium',
              active(link.href)
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border/70 text-muted-foreground hover:text-foreground'
            )}
          >
            {link.name}
          </Link>
        ))}
      </nav>
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24 space-y-7">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mono-label mb-2 px-3">{group.title}</p>
              <ul className="space-y-0.5">
                {group.links.map((link) => {
                  const isActive = active(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
                          isActive
                            ? 'bg-[hsl(var(--rvx-surface))] text-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {link.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

export function DocsFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:py-12">
      <DocsNav />
      <main className="min-w-0 flex-1 pb-16">
        <article className="mx-auto max-w-3xl">{children}</article>
      </main>
    </div>
  );
}
