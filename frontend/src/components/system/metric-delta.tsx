import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

/**
 * MetricDelta — "what changed" beside a headline number.
 *
 * Renders nothing when there is no value to compare, because an absent
 * comparison is not the same as "no change" — and a dashboard that implies
 * movement it cannot measure is exactly the fake-metric problem.
 *
 * Colour carries surplus meaning only; the arrow and the signed number carry
 * the actual information.
 */
export function MetricDelta({
  value,
  semantics = 'lower-is-better',
  label,
  suffix = '',
  showZero = false,
  className,
}: {
  /** The change itself, e.g. -3 or +12. Null/undefined renders nothing. */
  value: number | null | undefined;
  /** Which direction is good. Findings: lower is better. Coverage: higher. */
  semantics?: 'lower-is-better' | 'higher-is-better';
  /** Context for the delta, e.g. "since last scan". */
  label?: string;
  suffix?: string;
  /** Render an explicit neutral state for an exact zero. */
  showZero?: boolean;
  className?: string;
}) {
  if (value == null || Number.isNaN(value)) return null;
  if (value === 0 && !showZero) return null;

  const improved =
    value === 0 ? false : semantics === 'lower-is-better' ? value < 0 : value > 0;
  const regressed =
    value === 0 ? false : semantics === 'lower-is-better' ? value > 0 : value < 0;

  const Icon = value === 0 ? Minus : value < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-mono font-semibold tabular-nums',
          improved && 'band-strong',
          regressed && 'band-weak',
          !improved && !regressed && 'text-muted-foreground'
        )}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {value > 0 ? `+${value}` : value}
        {suffix}
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}
