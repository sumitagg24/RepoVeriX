import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Charts.
 *
 * Only two rules matter here: every chart is driven by counts the API actually
 * returned, and every chart ships a text equivalent so the number is available
 * without reading the graphic. No filler series, no invented trend lines.
 */
export interface BarDatum {
  label: string;
  value: number;
  tone?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'verified' | 'accent' | 'neutral';
}

const BAR_FILL: Record<string, string> = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  info: 'bg-info',
  verified: 'bg-verified',
  accent: 'bg-accent',
  neutral: 'bg-neutral-400',
};

export function BarChart({
  data,
  label,
  className,
  emptyLabel = 'No data recorded yet.',
}: {
  data: BarDatum[];
  label: string;
  className?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const hasData = data.some((datum) => datum.value > 0);

  if (!hasData) {
    return <p className={cn('text-[13px] text-muted', className)}>{emptyLabel}</p>;
  }

  return (
    <div className={className}>
      <div className="flex items-end gap-3" role="img" aria-label={`${label}: ${data.map((d) => `${d.value} ${d.label}`).join(', ')}`}>
        {data.map((datum) => (
          <div key={datum.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span data-numeric className="font-mono text-[12px] text-ink">
              {datum.value}
            </span>
            <span
              className={cn('w-full rounded-sm', BAR_FILL[datum.tone ?? 'neutral'])}
              style={{ height: `${Math.max(4, (datum.value / max) * 72)}px` }}
            />
            <span className="truncate text-[12px] text-muted" title={datum.label}>
              {datum.label}
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label}>
              <th scope="row">{datum.label}</th>
              <td>{datum.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Verification outcome strip: verified / probable / rejected as three labelled
 * figures. Used wherever a screen needs to state what validation concluded.
 */
export function OutcomeSummary({
  verified,
  probable,
  rejected,
  className,
}: {
  verified: number;
  probable: number;
  rejected: number;
  className?: string;
}) {
  const rows: { label: string; value: number; tone: string }[] = [
    { label: 'Verified', value: verified, tone: 'text-verified' },
    { label: 'Probable', value: probable, tone: 'text-probable' },
    { label: 'Rejected', value: rejected, tone: 'text-rejected' },
  ];

  return (
    <dl className={cn('flex flex-wrap gap-x-6 gap-y-3', className)}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[12.5px] text-muted">{row.label}</dt>
          <dd data-numeric className={cn('mt-1 text-[20px] font-semibold leading-none', row.tone)}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
