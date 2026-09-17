'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo, LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { EvidenceLoopStrip } from '@/components/system/evidence-chain';
import { ShieldCheck, FileSearch, Hammer } from 'lucide-react';

/**
 * RVX AuthShell — one visual language for landing → auth → onboarding → app.
 * Left: the form. Right: the product loop (Analyze → Evidence → Repair →
 * Verify) rendered as real RepoVeriX UI, clearly illustrative. Collapses to a
 * single column on mobile — no split-screen squeeze.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.08),transparent)]"
      />
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="RepoVeriX home">
          <Logo />
        </Link>
        <ThemeToggle variant="solid" />
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
        <div className="mx-auto w-full max-w-sm lg:mx-0">
          <div className="mb-6 lg:hidden">
            <LogoMark className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="animate-rise mt-6 rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          <p className="mt-6 text-center text-xs text-muted-foreground lg:text-left">
            Protected by rate limiting and encrypted sessions. Read the{' '}
            <Link href="/docs/account-security" className="font-medium text-primary hover:underline">
              account security guide
            </Link>
            .
          </p>
        </div>

        <aside
          aria-label="How RepoVeriX works (illustrative preview)"
          className="hidden rounded-2xl border bg-card/70 p-6 shadow-sm backdrop-blur lg:block"
        >
          <p className="mono-label">Illustrative preview — your workspace after sign in</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-balance">
            Audit software. Trace the evidence. Prove the fix.
          </h2>
          <div className="mt-4">
            <EvidenceLoopStrip />
          </div>
          <ol className="mt-5 space-y-3 text-sm">
            {[
              { icon: FileSearch, title: 'Analyze', body: 'Repository or website → deterministic detectors + LLM reasoning.' },
              { icon: ShieldCheck, title: 'Evidence', body: 'Source → transformation → sink, with confidence — VERIFIED / PROBABLE / REJECTED.' },
              { icon: Hammer, title: 'Repair → Verify', body: 'Candidate patch runs tests + static checks in a sandbox before VERIFIED FIX.' },
            ].map((row) => (
              <li key={row.title} className="flex gap-3 rounded-xl border border-border/60 bg-background/60 p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <row.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="font-semibold">{row.title}. </span>
                  <span className="text-muted-foreground">{row.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            No fake findings, ever — empty workspaces show onboarding actions, not invented metrics.
          </p>
        </aside>
      </main>
    </div>
  );
}
