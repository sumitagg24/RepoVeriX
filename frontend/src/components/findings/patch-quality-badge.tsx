'use client';

import { Badge } from '@/components/ui/badge';
import { usePatchQuality } from '@/hooks/usePatches';
import { Gauge, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { qualityTone, toneBorder, toneInk, toneSurface } from '@/lib/tone';

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
  const tone = qualityTone(data.grade);
  return (
    <Badge
      variant="outline"
      title={data.breakdown.map((b) => `${b.criterion}: ${b.points > 0 ? '+' : ''}${b.points} — ${b.detail}`).join('\n')}
      className={cn('gap-1 text-[10px]', toneSurface(tone), toneInk(tone), toneBorder(tone))}
    >
      <Gauge className="h-3 w-3" />
      {data.score} / 100 · {data.grade}
    </Badge>
  );
}
