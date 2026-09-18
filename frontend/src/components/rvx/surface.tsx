import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type SurfaceTone = 'canvas' | 'panel' | 'inset' | 'clear';

const toneClass: Record<SurfaceTone, string> = {
  canvas: 'rvx-canvas',
  panel: 'bg-[hsl(var(--rvx-surface))]',
  inset: 'bg-[hsl(var(--rvx-inset))]',
  clear: 'bg-transparent',
};

export function RvxShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-screen bg-[hsl(var(--rvx-canvas))] text-foreground', className)}>
      {children}
    </div>
  );
}

export function RvxSection({
  children,
  className,
  bleed = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn('border-b rvx-hairline', className)}>
      <div className={cn('mx-auto w-full px-4 py-14 sm:px-6 lg:py-16', bleed ? 'max-w-none' : 'max-w-[1440px]')}>
        {children}
      </div>
    </section>
  );
}

export function RvxHeader({
  kicker,
  title,
  body,
  action,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4 mb-6', className)}>
      <div className="max-w-3xl">
        {kicker ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
            {kicker}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {body ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function RvxSurface({
  children,
  className,
  tone = 'panel',
  as,
}: {
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
  as?: ElementType;
}) {
  const Component = as ?? 'div';
  return (
    <Component
      className={cn(
        'rounded-xl border border-border/70 shadow-sm transition-all',
        toneClass[tone],
        className
      )}
    >
      {children}
    </Component>
  );
}

export function RvxLedger({
  children,
  className,
  header,
}: {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm', className)}>
      {header ? (
        <div className="border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-foreground">
          {header}
        </div>
      ) : null}
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

export function RvxProductFrame({
  children,
  title,
  meta,
  className,
}: {
  children: ReactNode;
  title: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl ring-1 ring-border/50', className)}>
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </span>
        <span className="ml-2 font-mono text-xs text-foreground/80 font-medium truncate">{title}</span>
        {meta ? <span className="ml-auto shrink-0">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function RvxStat({
  value,
  label,
  detail,
  tone = 'default',
}: {
  value: ReactNode;
  label: string;
  detail?: ReactNode;
  tone?: 'default' | 'source' | 'sink' | 'verify' | 'muted';
}) {
  const color =
    tone === 'source'
      ? 'text-[hsl(var(--rvx-source))]'
      : tone === 'sink'
        ? 'text-[hsl(var(--rvx-sink))]'
        : tone === 'verify'
          ? 'text-[hsl(var(--rvx-verified))]'
          : tone === 'muted'
            ? 'text-muted-foreground'
            : 'text-foreground';

  return (
    <div className="min-w-0">
      <p className={cn('rvx-num text-3xl leading-none sm:text-4xl', color)}>{value}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </p>
      {detail ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
