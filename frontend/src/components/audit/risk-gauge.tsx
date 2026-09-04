import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const LEVEL_STYLES: Record<string, string> = {
  low: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

export function levelColor(score: number): string {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 25) return '#eab308';
  return '#22c55e';
}

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  return (
    <Badge variant="outline" className={LEVEL_STYLES[level] ?? ''}>
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
          <Badge variant="outline" className={LEVEL_STYLES[level] ?? ''}>
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
