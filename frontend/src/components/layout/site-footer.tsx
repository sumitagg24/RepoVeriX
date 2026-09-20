import Link from 'next/link';

import { LogoMark } from '@/components/layout/logo';
import { Shell } from '@/components/layout/shell';
import { SITE } from '@/lib/site';

/**
 * Footer.
 *
 * One considered set of destinations instead of a link farm: product, resources,
 * account. The legal row is always present because the product stores source
 * snapshots, which is exactly the kind of thing a reader wants a policy for.
 */
const GROUPS = [
  {
    title: 'Product',
    links: [
      { href: '/product', label: 'Platform' },
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
      { href: '/docs/concepts', label: 'Evidence model' },
      { href: '/docs/api', label: 'API reference' },
      { href: '/resources', label: 'Research and resources' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/auth/sign-in', label: 'Sign in' },
      { href: '/auth/sign-up', label: 'Create an account' },
      { href: '/dashboard', label: 'Workspace' },
      { href: '/billing', label: 'Billing and usage' },
      { href: '/help', label: 'Help' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-canvas">
      <Shell width="wide" className="py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 text-ink">
              <LogoMark className="text-accent" />
              <span className="text-[15px] font-semibold tracking-[-0.02em]">{SITE.name}</span>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{SITE.tagline}</p>
            <p className="mt-4 text-[12.5px] leading-relaxed text-faint">
              Findings state their confidence and their reachability. Verdicts state what was executed.
              Nothing on a finding page is asserted without the record behind it.
            </p>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-[13px] font-medium text-ink">{group.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-xs text-[13px] text-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-hairline pt-6 text-[12.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} RepoVeriX. Repository security with a recorded trail.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/docs/api" className="transition-colors hover:text-ink">
              API
            </Link>
          </div>
        </div>
      </Shell>
    </footer>
  );
}
