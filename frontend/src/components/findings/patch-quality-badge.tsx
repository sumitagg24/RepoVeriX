'use client';

import { Badge } from '@/components/ui/badge';
import { usePatchQuality } from '@/hooks/usePatches';
import { Gauge, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PatchQualityBadge({ patchId }: { patchId: string }) {
  const { data, isLoading } = usePatchQuality(patchId);
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" /> scoring…
      </Badge>
    );
  }
  if (!data) return null;
  const styles: Record<string, string> = {
    excellent: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    good: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    fair: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    poor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  };
  return (
    <Badge
      variant="outline"
      title={data.breakdown.map((b) => `${b.criterion}: ${b.points > 0 ? '+' : ''}${b.points} — ${b.detail}`).join('\n')}
      className={cn('gap-1 text-[10px]', styles[data.grade])}
    >
      <Gauge className="h-3 w-3" />
      {data.score} / 100 · {data.grade}
    </Badge>
  );
}
