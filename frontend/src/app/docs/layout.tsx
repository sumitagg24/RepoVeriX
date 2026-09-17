'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { BookOpen, ChevronRight, Home } from 'lucide-react';

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

const flat = groups.flatMap((g) => g.links);

export default function DocsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === '/docs' ? pathname === '/docs' : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top header */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="RepoVeriX home" className="flex items-center gap-2.5">
              <Logo />
            </Link>
            <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                Docs
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex">
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="shadow-sm">Start free</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:py-12">
        {/* Mobile chip nav */}
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {flat.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                active(l.href)
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border/70 text-muted-foreground hover:text-foreground'
              )}
            >
              {l.name}
            </Link>
          ))}
        </nav>

        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 space-y-7">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {g.title}
                </p>
                <ul className="space-y-0.5">
                  {g.links.map((l) => {
                    const isActive = active(l.href);
                    return (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {isActive && <span className="h-4 w-0.5 rounded-full bg-primary" />}
                          <span className={cn(!isActive && 'pl-2')}>{l.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 pb-16">
          <article className="mx-auto max-w-3xl">{children}</article>
          {/* Footer links */}
          <footer className="mx-auto mt-14 max-w-3xl border-t border-border/60 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>© 2026 RepoVeriX</span>
              <div className="flex items-center gap-4">
                <Link href="/privacy" className="transition-colors hover:text-foreground">
                  Privacy
                </Link>
                <Link href="/terms" className="transition-colors hover:text-foreground">
                  Terms
                </Link>
                <Link href="/docs/faq" className="transition-colors hover:text-foreground">
                  FAQ
                </Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
