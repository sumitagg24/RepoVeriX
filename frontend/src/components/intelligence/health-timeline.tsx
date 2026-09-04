'use client';

import { useHealthTimeline } from '@/hooks/useAudit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Loader2, TrendingDown, TrendingUp } from 'lucide-react';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 560;
  const h = 120;
  const pad = 12;
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const range = Math.max(0.1, max - min);
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const color = values[values.length - 1] >= values[0] ? '#22c55e' : '#ef4444';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label="Health score over time">
      <defs>
        <linearGradient id="hv-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[2, 4, 6, 8, 10].map((g) => {
        const y = h - pad - ((g - min) / range) * (h - pad * 2);
        return (
          <g key={g}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
            <text x={2} y={y + 3} fontSize="9" fill="currentColor" fillOpacity="0.4">
              {g}
            </text>
          </g>
        );
      })}
      <polygon points={`${points} ${w - pad},${h - pad} ${pad},${h - pad}`} fill="url(#hv-fill)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color} stroke="hsl(var(--background))" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

export function HealthTimeline({ repositoryId }: { repositoryId: string }) {
  const { data, isLoading, isError } = useHealthTimeline(repositoryId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading health history…
        </CardContent>
      </Card>
    );
  }
  const points = data?.points ?? [];
  if (isError || points.length < 2) {
    return null; // hide when there is no history yet (single snapshot)
  }

  const scores = points.map((p) => p.average_score ?? 0);
  const improving = scores[scores.length - 1] >= scores[0];
  const latest = scores[scores.length - 1];
  const first = scores[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <LineChart className="h-4 w-4 text-primary" /> Health over time
          </CardTitle>
          <CardDescription>
            One point per index snapshot ({points.length} recorded)
          </CardDescription>
        </div>
        <span
          className={
            improving
              ? 'flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400'
              : 'flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400'
          }
        >
          {improving ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {first.toFixed(1)} → {latest.toFixed(1)}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        <Sparkline values={scores} />
        <div className="flex flex-wrap gap-2 pt-1">
          {points.map((p) => (
            <span key={p.recorded_at} className="text-[10px] tabular-nums text-muted-foreground">
              {new Date(p.recorded_at).toLocaleDateString()} · {p.average_score?.toFixed(1) ?? '—'}
              {p.commit_sha ? ` · ${p.commit_sha}` : ''}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
