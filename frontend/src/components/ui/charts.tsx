import * as React from 'react';
import { BadgeCheck, CircleSlash, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Charts.
 *
 * Every visualisation here answers one question and states its numbers in text,
 * so a reader who cannot see the bar still gets the value: the bar is a
 * comparison aid, not the data. Nothing is invented to fill a panel — the
 * callers pass the counts the API returned.
 */

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
  tone?: 'accent' | 'critical' | 'high' | 'medium' | 'low' | 'verified' | 'neutral';
}

const FILL: Record<NonNullable<BarDatum['tone']>, string> = {
  accent: 'bg-accent',
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  verified: 'bg-verified',
  neutral: 'bg-neutral-400',
};

/**
 * Horizontal bars over a shared scale.
 *
 * A table underneath carries the label and the value, which doubles as the
 * accessible representation: a screen reader reads real rows rather than a
 * decorative graphic.
 */
export function BarChart({
  data,
  label,
  className,
  emptyLabel = 'Nothing to chart yet',
}: {
  data: BarDatum[];
  label: string;
  className?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 0);

  if (data.length === 0 || max === 0) {
    return <p className={cn('text-[13px] text-muted', className)}>{emptyLabel}</p>;
  }

  return (
    <table className={cn('w-full border-collapse', className)}>
      <caption className="sr-only">{label}</caption>
      <tbody>
        {data.map((item) => {
          const width = Math.max(2, Math.round((item.value / max) * 100));
          return (
            <tr key={`${label}-${item.label}`}>
              <th
                scope="row"
                className="w-[42%] max-w-0 truncate py-1.5 pr-3 text-left text-[12.5px] font-normal text-body"
                title={item.label}
              >
                {item.label}
              </th>
              <td className="py-1.5" aria-hidden="true">
                <span className="block h-2 w-full overflow-hidden rounded-full bg-surface">
                  <span
                    className={cn('block h-full rounded-full', FILL[item.tone ?? 'accent'])}
                    style={{ width: `${width}%` }}
                  />
                </span>
              </td>
              <td
                data-numeric
                className="w-[4.5rem] whitespace-nowrap py-1.5 pl-3 text-right font-mono text-[12.5px] text-ink"
              >
                {item.hint ?? item.value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Validation outcome.
 *
 * The three verdicts side by side with their counts, because the useful reading
 * is the ratio between them and not any single number.
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
  const total = verified + probable + rejected;
  const rows = [
    {
      key: 'verified',
      label: 'Verified',
      value: verified,
      icon: BadgeCheck,
      tone: 'text-verified',
      hint: 'Evidence validation confirmed the claim against the repository code.',
    },
    {
      key: 'probable',
      label: 'Probable',
      value: probable,
      icon: Sparkles,
      tone: 'text-high',
      hint: 'Grounded in evidence, but a counterexample could not be ruled out.',
    },
    {
      key: 'rejected',
      label: 'Rejected',
      value: rejected,
      icon: CircleSlash,
      tone: 'text-muted',
      hint: 'Validation refuted the claim; the finding stays with its refutation.',
    },
  ];

  return (
    <dl className={cn('space-y-3', className)}>
      {rows.map((row) => {
        const Icon = row.icon;
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        return (
          <div key={row.key} className="flex items-start gap-3">
            <Icon className={cn('mt-0.5 size-4 shrink-0', row.tone)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] font-medium text-ink">{row.label}</dt>
                <dd data-numeric className="font-mono text-[12.5px] text-muted">
                  {row.value}
                  {total > 0 ? ` · ${share}%` : ''}
                </dd>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{row.hint}</p>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
