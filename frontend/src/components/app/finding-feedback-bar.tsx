'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { findingService } from '@/services/api';
import type { FeedbackVerdict } from '@/types/api';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, CheckCheck, MinusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const OPTIONS: { verdict: FeedbackVerdict; label: string; icon: typeof ThumbsUp }[] = [
  { verdict: 'correct', label: 'Correct', icon: ThumbsUp },
  { verdict: 'incorrect', label: 'False positive', icon: ThumbsDown },
  { verdict: 'already_fixed', label: 'Already fixed', icon: CheckCheck },
  { verdict: 'not_useful', label: 'Not useful', icon: MinusCircle },
];

/**
 * The false-positive feedback loop, surfaced on every finding: the user's
 * verdict is stored per finding and aggregates feed detection-quality
 * metrics. Selecting an option replaces any earlier verdict.
 */
export function FindingFeedbackBar({ findingId }: { findingId: string }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | undefined>(undefined);

  const { data: mine } = useQuery({
    queryKey: ['feedback', findingId],
    queryFn: () => findingService.getMyFeedback(findingId),
  });

  const mutation = useMutation({
    mutationFn: (verdict: FeedbackVerdict) =>
      findingService.submitFeedback(findingId, verdict, note),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['feedback', findingId] });
      const label = OPTIONS.find((o) => o.verdict === row.verdict)?.label ?? row.verdict;
      toast.success(`Thanks — recorded as “${label}”`);
    },
    onError: () => toast.error('Could not record feedback'),
  });

  const withdraw = useMutation({
    mutationFn: () => findingService.deleteFeedback(findingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', findingId] });
      toast('Feedback removed');
    },
  });

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5"
      role="group"
      aria-label="Rate this finding"
    >
      <span className="text-xs font-medium text-muted-foreground">Is this finding accurate?</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {OPTIONS.map(({ verdict, label, icon: Icon }) => {
          const active = mine?.verdict === verdict;
          return (
            <Button
              key={verdict}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
              aria-pressed={active}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(verdict)}
            >
              {mutation.isPending && mutation.variables === verdict ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Icon className="h-3.5 w-3.5" aria-hidden />
              )}
              {label}
            </Button>
          );
        })}
      </div>
      {mine && (
        <button
          type="button"
          className="ml-auto text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => withdraw.mutate()}
        >
          Remove my feedback
        </button>
      )}
    </div>
  );
}
