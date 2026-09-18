import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Surfaces.
 *
 * Panels are for framed tools, repeated items and grouped settings. Static
 * content blocks separate themselves with `.rule` and spacing instead, so a page
 * does not turn into a grid of boxes.
 */
export function Panel({
  className,
  muted = false,
  interactive = false,
  as: Component = 'div',
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  muted?: boolean;
  interactive?: boolean;
  as?: React.ElementType;
}) {
  return (
    <Component
      className={cn('panel', muted && 'panel-muted', interactive && 'panel-hover', className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function PanelHeader({
  title,
  hint,
  actions,
  icon,
  className,
  titleAs: TitleTag = 'h2',
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  titleAs?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 text-muted" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <TitleTag className="text-[15px] font-semibold leading-6 text-ink">{title}</TitleTag>
          {hint ? (
            <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted">{hint}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PanelFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('mt-4 border-t border-hairline pt-4 text-[13px] text-muted', className)}>
      {children}
    </div>
  );
}

/**
 * Callout: a statement that is genuinely advisory (a limitation, a caution, a
 * next step). Not a decoration — if it does not change what the reader does,
 * it should be body copy.
 */
export function Callout({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'accent' | 'warning' | 'critical' | 'verified';
  title?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-info-line bg-info-soft text-info',
    accent: 'border-accent-line bg-accent-soft text-accent',
    warning: 'border-high-line bg-high-soft text-high',
    critical: 'border-critical-line bg-critical-soft text-critical',
    verified: 'border-verified-line bg-verified-soft text-verified',
  } as const;

  return (
    <div className={cn('rounded-md border px-3.5 py-3', tones[tone], className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <p className="text-[13.5px] font-medium">{title}</p> : null}
          <div className={cn('text-[13px] leading-relaxed', title && 'mt-1', 'text-body')}>
            {children}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
