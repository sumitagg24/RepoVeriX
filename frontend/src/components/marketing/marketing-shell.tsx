import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  CircleDot,
  FileCode2,
  GitBranch,
  Github,
  Gitlab,
  Menu,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { RvxShell } from '@/components/rvx/surface';

/**
 * MarketingShell — the single chrome for every public page.
 *
 * Before this existed, each public page inlined its own nav and footer (or had
 * none at all): the homepage carried dead `href="#"` footer links, /tools
 * rolled its own header, and the SEO hubs each shipped a bespoke breadcrumb
 * bar. Nav and footer are now defined once here.
 *
 * Notes on the implementation:
 *  - The dropdown panels are CSS-only (`group-hover` / `group-focus-within`), so
 *    keyboard users open them by focusing the trigger. The trigger is always a
 *    real link to a real hub page, so the menu is never the only way through.
 *  - The mobile menu is a native <details> disclosure — no JS, and its links are
 *    absent from the accessibility tree while collapsed.
 *  - No link in this file points at "#": every target is a shipped route.
 *  - This component deliberately does NOT render <main>; pages own their own
 *    landmark and content width.
 */

const NAV_GROUPS: {
  label: string;
  href: string;
  cue: string;
  items: { label: string; href: string; note: string }[];
}[] = [
  {
    label: 'Product',
    href: '/docs/features',
    cue: 'Follow risk from source to verified fix.',
    items: [
      { label: 'Repository intelligence', href: '/docs/features', note: 'Index, audit and explain code risk.' },
      { label: 'Evidence chains', href: '/docs/concepts', note: 'Source, transform, sink, patch, verify.' },
      { label: 'Verified repairs', href: '/docs/concepts', note: 'Patches checked by execution.' },
      { label: 'API reference', href: '/docs/api', note: 'Automate the workflow.' },
    ],
  },
  {
    label: 'Solutions',
    href: '/integrations/github',
    cue: 'Where RepoVeriX fits into your workflow.',
    items: [
      { label: 'GitHub', href: '/integrations/github', note: 'Import repos and review findings.' },
      { label: 'GitLab', href: '/integrations/gitlab', note: 'Analyze projects without changing flow.' },
      { label: 'Comparisons', href: '/compare', note: 'Position against scanner categories.' },
      { label: 'Vulnerable repos', href: '/vulnerable-repos', note: 'Try known fixtures.' },
    ],
  },
  {
    label: 'Resources',
    href: '/docs',
    cue: 'Rules, references and operational docs.',
    items: [
      { label: 'Detection rules', href: '/detections', note: 'Rule catalog and examples.' },
      { label: 'Vulnerability classes', href: '/vulnerabilities', note: 'Plain-English risk guides.' },
      { label: 'Glossary', href: '/glossary', note: 'Security and code analysis terms.' },
      { label: 'Research', href: '/docs/research', note: 'Methodology and reproducibility.' },
      { label: 'Changelog', href: '/changelog', note: 'Product changes.' },
      { label: 'Blog', href: '/blog', note: 'Security engineering notes.' },
    ],
  },
];

const SIMPLE_LINKS: { label: string; href: string }[] = [
  { label: 'Tools', href: '/tools' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Docs', href: '/docs' },
];

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Platform overview', href: '/docs/features' },
      { label: 'Core concepts', href: '/docs/concepts' },
      { label: 'Tools', href: '/tools' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'GitHub', href: '/integrations/github' },
      { label: 'GitLab', href: '/integrations/gitlab' },
      { label: 'Compare', href: '/compare' },
      { label: 'Vulnerable repos', href: '/vulnerable-repos' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Detection rules', href: '/detections' },
      { label: 'Vulnerability classes', href: '/vulnerabilities' },
      { label: 'Glossary', href: '/glossary' },
      { label: 'Help center', href: '/help' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="RepoVeriX home" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <Logo />
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="group relative">
                  <Link
                    href={group.href}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
                  >
                    {group.label}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 group-hover:rotate-180" aria-hidden="true" />
                  </Link>
                  <div className="pointer-events-none invisible absolute left-0 top-full z-50 w-80 translate-y-1 rounded-xl border border-border/70 bg-card p-3 opacity-0 shadow-xl transition-all duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <p className="border-b border-border/50 px-2.5 pb-2 pt-1 text-[11px] font-medium text-muted-foreground">
                      {group.cue}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/40"
                        >
                          <span className="block text-sm font-medium text-foreground">{item.label}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {item.note}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {SIMPLE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="ghost" />
            <Link href="/auth/login" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="font-medium text-muted-foreground hover:text-foreground">
                Sign in
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" className="shadow-sm font-medium">
                Start free
              </Button>
            </Link>

            {/* Mobile menu — native disclosure, no JS */}
            <details className="relative md:hidden">
              <summary
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 max-h-[75vh] w-72 overflow-y-auto rounded-xl border border-border/80 bg-card p-3 shadow-xl">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label} className="mb-3 last:mb-0">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <div className="border-t border-border/60 pt-2 space-y-1">
                  {SIMPLE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Link
                    href="/auth/login"
                    className="block rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Main Content Landmark */}
      <div className="flex-1">{children}</div>

      {/* Modern SaaS Footer */}
      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
            <div className="space-y-4">
              <Logo />
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Repository security and code intelligence platform. Find code risks, understand propagation paths, and verify automated repairs in isolated sandboxes.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <Link href="/integrations/github" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <Github className="h-4 w-4" aria-hidden="true" />
                  GitHub App
                </Link>
                <Link href="/integrations/gitlab" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <Gitlab className="h-4 w-4" aria-hidden="true" />
                  GitLab CI
                </Link>
                <Link href="/docs/api" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <FileCode2 className="h-4 w-4" aria-hidden="true" />
                  Developer API
                </Link>
              </div>
            </div>

            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {column.title}
                </p>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} RepoVeriX Inc. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-5">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Operational
              </span>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <Link href="/docs" className="hover:text-foreground transition-colors">
                Documentation
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
