import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Numbers and key/value rows.
 *
 * Metrics sit in plain layout separated by hairlines rather than in six bordered
 * cards: the figures are the design, so the container stays out of the way.
 */
export function MetricStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 divide-y divide-hairline border-y border-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 [&>*]:border-hairline sm:[&>*:nth-child(n+3)]:border-t lg:[&>*:not(:first-child)]:border-l',
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'critical' | 'high' | 'verified';
  icon?: React.ReactNode;
  className?: string;
}) {
  const toneClass = {
    neutral: 'text-ink',
    accent: 'text-accent',
    critical: 'text-critical',
    high: 'text-high',
    verified: 'text-verified',
  }[tone];

  return (
    <div className={cn('px-4 py-4 sm:px-5', className)}>
      <dt className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
        {icon ? (
          <span className="text-faint" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {label}
      </dt>
      <dd
        data-numeric
        className={cn('mt-2 text-[26px] font-semibold leading-none tracking-tight', toneClass)}
      >
        {value}
      </dd>
      {hint ? <dd className="mt-2 text-[12.5px] leading-relaxed text-muted">{hint}</dd> : null}
    </div>
  );
}

/** Key/value rows for detail sidebars and profile blocks. */
export function DetailList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-hairline', className)}>{children}</dl>;
}

export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', className)}>
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      {/* Machine output (storage paths, token counts, JSON) has nothing to wrap
          on, so it is allowed to break inside the value column. */}
      <dd className="min-w-0 break-words text-right text-[13px] text-ink">{children}</dd>
    </div>
  );
}

/** Determinate progress with an announced value. */
export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'accent',
  showValue = true,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  tone?: 'accent' | 'critical' | 'high' | 'verified';
  showValue?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = {
    accent: 'bg-accent',
    critical: 'bg-critical',
    high: 'bg-high',
    verified: 'bg-verified',
  }[tone];

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-body">{label}</span>
        {showValue ? (
          <span data-numeric className="font-mono text-[12px] text-muted">
            {value}
            {max !== 100 ? ` / ${max}` : '%'}
          </span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export interface DistributionSegment {
  label: string;
  value: number;
  tone?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'verified' | 'neutral';
}

const SEGMENT_FILL: Record<string, string> = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  info: 'bg-info',
  verified: 'bg-verified',
  neutral: 'bg-neutral-400',
};

/**
 * Severity distribution.
 *
 * The bar is decorative; the legend below carries the numbers, so the value is
 * readable without seeing colour at all.
 */
export function DistributionBar({
  segments,
  total,
  label,
  className,
}: {
  segments: DistributionSegment[];
  total?: number;
  label: string;
  className?: string;
}) {
  const sum = total ?? segments.reduce((acc, segment) => acc + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <div className={className}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-strong"
        role="img"
        aria-label={`${label}: ${visible.map((s) => `${s.value} ${s.label}`).join(', ') || 'no data'}`}
      >
        {visible.map((segment) => (
          <span
            key={segment.label}
            className={cn('h-full', SEGMENT_FILL[segment.tone ?? 'neutral'])}
            style={{ width: sum > 0 ? `${(segment.value / sum) * 100}%` : '0%' }}
          />
        ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <span
              className={cn('size-2 rounded-full', SEGMENT_FILL[segment.tone ?? 'neutral'])}
              aria-hidden="true"
            />
            <dt className="text-[12.5px] text-muted">{segment.label}</dt>
            <dd data-numeric className="font-mono text-[12.5px] text-ink">
              {segment.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
