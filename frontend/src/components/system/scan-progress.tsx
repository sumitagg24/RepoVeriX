import { cn } from '@/lib/utils';
import { toneHue } from '@/lib/tone';
import { AlertTriangle, Check, Circle, Loader2 } from 'lucide-react';

/**
 * ScanProgress — pipeline state for a scan.
 *
 * Honesty rule: the List/Scan API returns a lifecycle status, not a completion
 * percentage. So this component shows *stage* state, never a made-up "73%".
 * When real per-stage rows are available (`ScanDetail.analysis_runs`) they are
 * rendered verbatim; otherwise it degrades to lifecycle-level progress and the
 * running state is explicitly indeterminate.
 */

export interface ScanRunStage {
  stage: string;
  status: string;
}

const LIFECYCLE: { key: string; label: string }[] = [
  { key: 'pending', label: 'Queued' },
  { key: 'analyzing', label: 'Analyzing code' },
  { key: 'evidence', label: 'Validating evidence' },
  { key: 'completed', label: 'Findings ready' },
];

/** How far the lifecycle has progressed, per status. Derived, not guessed. */
const REACHED: Record<string, number> = {
  pending: 0,
  running: 2,
  completed: 4,
  failed: 2,
};

export function ScanProgress({
  status,
  error,
  runs,
  className,
}: {
  status: string | null | undefined;
  error?: string | null;
  /** Real analysis-run rows from the scan detail endpoint, when loaded. */
  runs?: ScanRunStage[] | null;
  className?: string;
}) {
  const key = (status ?? 'pending').toLowerCase();
  const failed = key === 'failed';
  const reached = REACHED[key] ?? 0;

  const steps =
    runs && runs.length > 0
      ? runs.map((run) => ({ label: run.stage.replace(/_/g, ' '), status: run.status }))
      : LIFECYCLE.map((entry, index) => ({
          label: entry.label,
          status: failed && index === reached ? 'failed' : index < reached ? 'completed' : index === reached ? 'running' : 'pending',
        }));

  return (
    <div className={cn('space-y-3', className)}>
      {(key === 'running' || key === 'pending') && (
        // Deliberately indeterminate: no percentage is known at this level.
        <div className="h-1 overflow-hidden rounded-full bg-muted" role="presentation">
          <span className="block h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
      )}

      <ol className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Scan progress">
        {steps.map((step, index) => {
          const isFailed = step.status === 'failed';
          const isDone = step.status === 'completed' || step.status === 'succeeded';
          const isActive = step.status === 'running' || step.status === 'in_progress';
          return (
            <li key={`${step.label}-${index}`} className="flex items-center gap-2">
              {isFailed ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              ) : isDone ? (
                <Check className={cn('h-3.5 w-3.5', toneHue('verified'))} aria-hidden="true" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden="true" />
              )}
              <span
                className={cn(
                  'text-xs capitalize',
                  isFailed
                    ? 'font-medium text-destructive'
                    : isDone
                      ? 'text-foreground'
                      : isActive
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {failed && (
        <p className="text-xs text-destructive">
          {error ? `Scan failed — ${error}` : 'Scan failed. The partial results above are what completed.'}
        </p>
      )}
    </div>
  );
}
