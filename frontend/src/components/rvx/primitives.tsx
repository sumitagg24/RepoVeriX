import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * RVX console primitives.
 *
 * Deliberately not card components. The console reads as a technical document:
 * hairline rules, mono metadata, figures that are typographic rather than
 * boxed, and one segmented meter. Nothing here floats, nothing is a pill, and
 * nothing carries decorative chrome — structure comes from alignment and rules.
 *
 * These are server components so marketing pages can use them without shipping
 * JavaScript for layout.
 */

/* ------------------------------------------------------------------ rules */

/**
 * A modern section header with optional right action.
 */
export function Rule({
  label,
  right,
  className,
}: {
  label: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4', className)}>
      <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{label}</h2>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- surface */

export function Panel({
  children,
  className,
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        'border border-border/70 bg-card text-card-foreground transition-all',
        flush ? 'rounded-lg p-3' : 'rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Inset({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border/60 bg-muted/40 p-3.5 text-xs text-foreground', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------- spine vocabulary */

export type Stage = 'source' | 'transform' | 'sink' | 'patch' | 'verify' | 'neutral';

export const STAGE_ORDER: Stage[] = ['source', 'transform', 'sink', 'patch', 'verify'];

const STAGE_LABEL: Record<Stage, string> = {
  source: 'Source',
  transform: 'Transform',
  sink: 'Sink',
  patch: 'Patch',
  verify: 'Verify',
  neutral: 'Step',
};

export function StageTag({ stage, children }: { stage: Stage; children?: ReactNode }) {
  const stageColors: Record<Stage, string> = {
    source: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    transform: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    sink: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    patch: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    verify: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        stageColors[stage]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{children ?? STAGE_LABEL[stage]}</span>
    </span>
  );
}

export function StageMeter({
  counts,
  className,
}: {
  counts: Partial<Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>>;
  className?: string;
}) {
  const order = ['critical', 'high', 'medium', 'low', 'info'] as const;
  const total = order.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  if (total === 0) {
    return (
      <span className={cn('text-xs text-muted-foreground font-medium', className)}>
        Zero active findings
      </span>
    );
  }

  const MAX_CELLS = 48;
  const scale = total > MAX_CELLS ? MAX_CELLS / total : 1;

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="flex h-2.5 flex-1 min-w-[120px] overflow-hidden rounded-full bg-muted">
        {order.map((key) => {
          const count = counts[key] ?? 0;
          if (count === 0) return null;
          const pct = Math.max(3, (count / total) * 100);
          const bg =
            key === 'critical'
              ? 'bg-rose-500'
              : key === 'high'
                ? 'bg-orange-500'
                : key === 'medium'
                  ? 'bg-amber-500'
                  : key === 'low'
                    ? 'bg-sky-500'
                    : 'bg-slate-400';
          return (
            <div
              key={key}
              style={{ width: `${pct}%` }}
              className={cn('h-full transition-all', bg)}
              title={`${count} ${key}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        {order
          .filter((key) => (counts[key] ?? 0) > 0)
          .map((key) => (
            <span key={key} className="tabular-nums">
              <span className="font-semibold text-foreground">{counts[key]}</span> {key.slice(0, 4)}
            </span>
          ))}
      </div>
    </div>
  );
}

/**
 * A modern SaaS KPI metric card.
 */
export function Figure({
  value,
  label,
  sub,
  tone = 'default',
  className,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  tone?: 'default' | 'critical' | 'verified' | 'muted';
  className?: string;
}) {
  const toneColor =
    tone === 'critical'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'verified'
        ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'muted'
          ? 'text-muted-foreground'
          : 'text-foreground';

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border',
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-2 text-3xl font-bold tracking-tight sm:text-4xl tabular-nums', toneColor)}>
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-xs font-medium text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------- ledger row */

export function LedgerRow({
  children,
  selected = false,
  className,
  columns = '1fr auto',
  as = 'div',
  ...rest
}: {
  children: ReactNode;
  selected?: boolean;
  className?: string;
  columns?: string;
  as?: 'div' | 'li' | 'tr';
} & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>) {
  const classes = cn(
    'grid items-center gap-3 border-b border-border/40 p-3.5 transition-colors text-left hover:bg-muted/40',
    selected && 'bg-primary/5 border-primary/30',
    className
  );
  const style = { gridTemplateColumns: columns } as React.CSSProperties;
  if (as === 'li') {
    return (
      <li className={classes} style={style} data-selected={selected} {...rest}>
        {children}
      </li>
    );
  }
  return (
    <div className={classes} style={style} data-selected={selected} {...rest}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- utilities */

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-xs text-muted-foreground', className)}>{children}</span>;
}

export function ConsoleEmpty({
  title,
  body,
  action,
  hint,
}: {
  title: string;
  body: string;
  action: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-6 flex justify-center">{action}</div>
      {hint ? <p className="mt-3 text-xs text-muted-foreground font-medium">{hint}</p> : null}
    </div>
  );
}

export function ConsoleSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-4 w-44 animate-pulse rounded-md bg-muted/70" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
      ))}
    </div>
  );
}
