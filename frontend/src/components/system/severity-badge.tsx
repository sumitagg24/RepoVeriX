import { cn } from '@/lib/utils';
import { asSeverity, SEVERITY_LABELS, type Severity } from '@/lib/evidence';

/**
 * SeverityBadge / SeverityMeter — compact severity presentation for dense rows.
 *
 * This is the *compact* face of the same language `components/evidence.tsx`
 * renders as `chip-lg` solids. Both read their labels from lib/evidence, and
 * both paint with the four-face `.sev-*` token classes, so severity can never
 * mean two different things on two different screens.
 *
 * Severity is never communicated by colour alone — the label is always shown.
 */

export function SeverityBadge({
  severity,
  variant = 'soft',
  size = 'sm',
  className,
}: {
  severity: string | null | undefined;
  /** `soft` = tinted chip for dense rows; `solid` = high-emphasis badge. */
  variant?: 'soft' | 'solid';
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const key: Severity = asSeverity(severity);
  return (
    <span
      className={cn(
        'chip',
        size === 'lg' && 'chip-lg',
        variant === 'solid' ? `sev-${key}` : `sev-${key}-soft`,
        className
      )}
    >
      <span className="chip-dot" aria-hidden="true" />
      {SEVERITY_LABELS[key]}
    </span>
  );
}

/**
 * SeverityMeter — labelled distribution bar for a set of severity counts.
 * Counts are always printed next to the bar, so the chart is never the only
 * carrier of meaning. Replaces the ad-hoc bars that had been copied per page.
 */
export function SeverityMeter({
  counts,
  className,
}: {
  counts: Partial<Record<Severity, number>>;
  className?: string;
}) {
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const total = order.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  if (total === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>No findings</p>;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="flex h-2 overflow-hidden rounded-full border border-border/60"
        role="img"
        aria-label={order
          .filter((key) => (counts[key] ?? 0) > 0)
          .map((key) => `${SEVERITY_LABELS[key]}: ${counts[key] ?? 0}`)
          .join(', ')}
      >
        {order.map((key) => {
          const value = counts[key] ?? 0;
          if (value === 0) return null;
          return (
            <span
              key={key}
              className={cn('h-full', `sev-${key}`)}
              style={{ width: `${(value / total) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {order
          .filter((key) => (counts[key] ?? 0) > 0)
          .map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-sm', `sev-${key}`)} aria-hidden="true" />
              {SEVERITY_LABELS[key]}
              <span className="font-mono tabular-nums text-foreground">{counts[key]}</span>
            </span>
          ))}
      </div>
    </div>
  );
}
