import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function H1({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="scroll-mt-24 font-display text-3xl font-semibold tracking-tight text-balance">
      {children}
    </h1>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 mt-10 border-b border-border/60 pb-2 font-display text-xl font-semibold tracking-tight"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="scroll-mt-24 mt-6 font-display text-base font-semibold tracking-tight">
      {children}
    </h3>
  );
}

export function P({ children, lead = false }: { children: ReactNode; lead?: boolean }) {
  return (
    <p className={cn('mt-3 leading-relaxed text-muted-foreground', lead && 'text-lg')}>{children}</p>
  );
}

/** Inline code. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground/90">
      {children}
    </code>
  );
}

/** Block code. */
export function Code({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      {title ? (
        <p className="border-b border-border/60 bg-muted/40 px-4 py-1.5 font-mono text-[11px] text-muted-foreground">
          {title}
        </p>
      ) : null}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        {children}
      </pre>
    </div>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">{children}</ul>;
}

export function Ol({ children }: { children: ReactNode }) {
  return <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">{children}</ol>;
}

export function Li({ children }: { children: ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      {title ? <p className="mb-2 text-sm font-semibold">{title}</p> : null}
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export function Callout({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'warn' | 'tip';
  children: ReactNode;
}) {
  const tones = {
    info: 'border-primary/30 bg-primary/5 text-foreground/90',
    warn: 'border-amber-500/40 bg-amber-500/5 text-foreground/90',
    tip: 'border-green-500/40 bg-green-500/5 text-foreground/90',
  };
  const labels = { info: 'Note', warn: 'Heads up', tip: 'Tip' };
  return (
    <div className={cn('mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed', tones[kind])}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider opacity-70">{labels[kind]}</p>
      {children}
    </div>
  );
}

/** Internal navigation link styled as a text link. */
export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

export function KeyVal({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 py-1.5 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
      <dt className="font-mono text-[0.85em] text-foreground/80">{k}</dt>
      <dd className="text-muted-foreground">{v}</dd>
    </div>
  );
}

/** Table with the standard doc styling. Columns are the header row; rows are data. */
export function DocTable({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
