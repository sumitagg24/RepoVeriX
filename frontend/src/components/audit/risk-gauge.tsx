import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { toneBorder, toneInk, toneSurface, type Tone } from '@/lib/tone';

/**
 * Audit risk level → semantic tone. `low` is not an alarm, so it uses the
 * calm `verified` face rather than a desaturated red.
 */
const LEVEL_TONE: Record<string, Tone> = {
  low: 'verified',
  medium: 'probable',
  high: 'high',
  critical: 'critical',
};

export function levelStyles(level: string): string {
  const tone = LEVEL_TONE[level] ?? 'neutral';
  return cn(toneSurface(tone), toneInk(tone), toneBorder(tone));
}

/**
 * The gauge stroke. Returned as a CSS custom-property reference rather than a
 * literal hex so the ring follows the severity tokens in both themes. This
 * value only ever lands in an SVG presentation attribute, never in a className,
 * so interpolation is safe here.
 */
export function levelColor(score: number): string {
  if (score >= 75) return 'hsl(var(--sev-critical))';
  if (score >= 50) return 'hsl(var(--sev-high))';
  if (score >= 25) return 'hsl(var(--sev-medium))';
  return 'hsl(var(--sev-low))';
}

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  return (
    <Badge variant="outline" className={levelStyles(level)}>
      {level.toUpperCase()}
      {typeof score === 'number' ? ` · ${score.toFixed(0)}/100` : ''}
    </Badge>
  );
}

export function RiskGauge({
  score,
  level,
  size = 128,
}: {
  score: number;
  level?: string | null;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const stroke = levelColor(clamped);
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="flex items-center gap-5">
      <div style={{ width: size, height: size }} className="relative">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: stroke }}>
            {clamped.toFixed(0)}
          </span>
          <span className="text-[10px] text-muted-foreground">/ 100 risk</span>
        </div>
      </div>
      {level && (
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className={levelStyles(level)}>
            {level.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground max-w-[110px]">
            {level === 'critical'
              ? 'Critical — review before merging'
              : level === 'high'
                ? 'High — needs review'
                : level === 'medium'
                  ? 'Medium — verify key factors'
                  : 'Low — routine change'}
          </span>
        </div>
      )}
    </div>
  );
}
