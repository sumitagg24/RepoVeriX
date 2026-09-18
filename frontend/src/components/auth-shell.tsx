'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Logo, LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignalSpine, type SpineStep } from '@/components/rvx/spine';
import { StageTag } from '@/components/rvx/primitives';
import { getRule } from '@/lib/seo/rules';
import { getSampleRepo } from '@/lib/seo/repos';

/**
 * AuthShell — the RepoVeriX authentication surface.
 *
 * The previous version framed the form in a card and put three explanation rows
 * beside it. This version does something more useful: the left half runs the
 * product's own signal spine, end to end, on the fixture that ships with the
 * test suite. Signing in should feel like being handed the console, not like
 * filling out a form next to a marketing panel.
 *
 * Everything is real: the stage names are the product's stages, the rule id is a
 * shipped rule, and the chain is rendered by the same component the finding
 * screen uses. The panel is labelled as the fixture it is — no invented
 * customer data, no fake metrics.
 */

const rule = getRule('rvx-sqli-001');
const fixture = getSampleRepo('vulnerable-app');
const endpoint = fixture?.endpoints.find((e) => e.route === 'GET /search');

/** The chain shown beside the form — the shipped fixture, source to verified. */
const CHAIN: SpineStep[] = [
  {
    id: 'auth-source',
    kind: 'source_input',
    label: `${endpoint?.route ?? 'GET /search'} — untrusted parameter name`,
    detail: endpoint?.note,
    location: 'app.py · route parameter',
    status: 'confirmed',
  },
  {
    id: 'auth-transform',
    kind: 'transformation',
    label: 'build_query() interpolates the value into the statement',
    detail: 'String interpolation makes the parameter part of the query language.',
    location: 'app.py · build_query()',
    status: 'confirmed',
  },
  {
    id: 'auth-sink',
    kind: 'sink',
    label: 'cursor.execute() runs the interpolated statement',
    detail: 'The sink is the point of no return.',
    location: 'app.py · cursor.execute()',
    status: 'confirmed',
  },
  {
    id: 'auth-patch',
    kind: 'patch',
    label: 'Candidate fix parameterizes the query',
    detail: 'The value stays data instead of becoming SQL text.',
    location: 'fixed_app.py',
    status: 'confirmed',
  },
  {
    id: 'auth-verify',
    kind: 'test',
    label: 'Tests run in a sandbox, then the file is re-analysed',
    detail: 'Only a passing, re-analysed patch is reported as verified.',
    location: 'tests/test_app.py',
    status: 'confirmed',
  },
];

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
    <div className="rvx-canvas flex min-h-screen flex-col">
      <header className="border-b rvx-hairline">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="RepoVeriX home" className="flex items-center gap-2.5">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="rvx-mono hidden text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
              secure console
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:py-14">
        {/* ------------------------------------------ the product, running */}
        <aside
          aria-label="Example investigation from the shipped vulnerable_app fixture"
          className="order-2 min-w-0 lg:order-1"
        >
          <div className="max-w-2xl">
            <p className="rvx-eyebrow">Example investigation · fixture</p>
            <h2 className="rvx-statement mt-3 text-[30px] sm:text-[38px]">
              Security intelligence
              <br />
              that shows its work.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Every finding carries the path that produced it — the request that carried the input,
              the code that transformed it, the sink that executed it, and the sandbox run that
              certified the repair.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StageTag stage="source" />
            <span aria-hidden="true" className="rvx-mono text-[10px] text-muted-foreground">
              →
            </span>
            <StageTag stage="transform" />
            <span aria-hidden="true" className="rvx-mono text-[10px] text-muted-foreground">
              →
            </span>
            <StageTag stage="sink" />
            <span aria-hidden="true" className="rvx-mono text-[10px] text-muted-foreground">
              →
            </span>
            <StageTag stage="patch" />
            <span aria-hidden="true" className="rvx-mono text-[10px] text-muted-foreground">
              →
            </span>
            <StageTag stage="verify" />
          </div>

          <div className="mt-5 max-w-xl overflow-hidden rounded-[var(--radius-lg)] border bg-[hsl(var(--rvx-surface))] rvx-hairline">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3.5 py-2.5 rvx-hairline">
              <span className="rvx-mono text-[11px] font-medium">
                {fixture?.name ?? 'vulnerable_app'}
              </span>
              <span className="rvx-mono text-[10px] text-muted-foreground">
                {rule?.id ?? 'RVX-SQLI-001'}
              </span>
              <span className="rvx-eyebrow ml-auto">critical</span>
            </div>
            <div className="p-3.5">
              <SignalSpine steps={CHAIN} title="Source to verified" dense />
            </div>
            <div className="border-t bg-[hsl(var(--rvx-inset))] px-3.5 py-2.5 rvx-hairline">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                The fixture repository that ships with RepoVeriX&apos;s test suite. Your workspace
                shows your repositories — never invented data.
              </p>
            </div>
          </div>
        </aside>

        {/* -------------------------------------------------- credential panel */}
        <section className="order-1 w-full min-w-0 lg:order-2" aria-labelledby="auth-title">
          <div className="mb-6 lg:hidden">
            <LogoMark className="h-8 w-8" />
          </div>

          <p className="rvx-eyebrow">{subtitle}</p>
          <h1 id="auth-title" className="rvx-title mt-2 text-2xl">
            {title}
          </h1>

          <div className="mt-6 rounded-[var(--radius-lg)] border bg-[hsl(var(--rvx-surface))] p-5 rvx-hairline sm:p-6">
            {children}
          </div>

          {footer && (
            <div className="mt-5 text-center text-[13px] text-muted-foreground">{footer}</div>
          )}

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Rate-limited sign-in, encrypted sessions and a full audit trail of authentication
              events. Read the{' '}
              <Link
                href="/docs/account-security"
                className="font-medium text-[hsl(var(--rvx-source))] hover:underline"
              >
                account security guide
              </Link>
              .
            </span>
          </p>
        </section>
      </main>
    </div>
  );
}

/**
 * AuthNotice — one treatment for every auth failure: OAuth callback errors,
 * expired sessions, invalid credentials, lockouts. Errors explain what happened
 * and what to do, instead of printing an opaque code.
 */
export function AuthNotice({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-[hsl(var(--sev-critical)/0.35)] bg-[hsl(var(--sev-critical)/0.07)] text-[hsl(var(--sev-critical))]'
      : tone === 'warning'
        ? 'border-[hsl(var(--sev-high)/0.35)] bg-[hsl(var(--sev-high)/0.07)] text-[hsl(var(--sev-high))]'
        : 'border-border bg-[hsl(var(--rvx-inset))] text-muted-foreground';

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-[var(--radius-md)] border p-3', toneClass, className)}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-[12px] leading-relaxed">{children}</div>
    </div>
  );
}
