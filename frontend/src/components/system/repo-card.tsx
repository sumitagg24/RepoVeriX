import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeverityBadge } from '@/components/system/severity-badge';
import { toneBar, type Tone } from '@/lib/tone';
import type { Repository } from '@/types/api';

/**
 * RepoCard — one repository in a grid.
 *
 * Deliberately stat-optional: the API does not return a health score or a
 * finding count on the Repository object, so a card only renders a stat when
 * the caller actually has it. Nothing here invents a number to fill space.
 */

/** Ingestion state reads through the same tones as everything else. */
const STATUS_TONE: Record<string, Tone> = {
  active: 'verified',
  ingested: 'verified',
  registered: 'observed',
  archived: 'neutral',
};

export function RepoCard({
  repository,
  findingsTotal,
  criticalTotal,
  lastScanLabel,
  className,
}: {
  repository: Repository;
  findingsTotal?: number | null;
  criticalTotal?: number | null;
  lastScanLabel?: string | null;
  className?: string;
}) {
  const languages = repository.primary_languages?.slice(0, 3) ?? [];
  const hasStats = typeof findingsTotal === 'number' || typeof criticalTotal === 'number';

  return (
    <Link
      href={`/repositories/${repository.id}`}
      className={cn(
        'group flex flex-col rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-primary/40',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{repository.name}</span>
            <span className="mono-label">
              {repository.source_type}
              {repository.default_branch ? ` · ${repository.default_branch}` : ''}
            </span>
          </span>
        </span>
        {criticalTotal != null && criticalTotal > 0 && <SeverityBadge severity="critical" />}
      </div>

      {languages.length > 0 && (
        <p className="mt-3 truncate font-mono text-xs text-muted-foreground">
          {languages.join(' · ')}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className={cn('h-2 w-2 rounded-full', toneBar(STATUS_TONE[repository.status] ?? 'neutral'))}
            aria-hidden="true"
          />
          <span className="capitalize">{repository.status}</span>
        </span>
        {hasStats ? (
          <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
            {typeof findingsTotal === 'number' && (
              <span>
                <span className="font-semibold text-foreground">{findingsTotal}</span> findings
              </span>
            )}
            {lastScanLabel && <span className="hidden sm:inline">{lastScanLabel}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {lastScanLabel ?? 'Not scanned yet'}
          </span>
        )}
      </div>
    </Link>
  );
}
