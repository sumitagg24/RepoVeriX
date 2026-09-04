'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFindingImpact } from '@/hooks/useAudit';
import { ArrowRight, Compass, Loader2, Siren, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ImpactPanel({ findingId }: { findingId: string }) {
  const { data, isLoading, isError, error } = useFindingImpact(findingId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Compass className="h-4 w-4 text-primary" /> Why does this matter?
        </CardTitle>
        <CardDescription>
          Reachability over the call graph and worst-case impact, computed deterministically —
          not a generic boilerplate paragraph.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing reachability…
          </div>
        )}
        {isError && (
          <p className="text-sm text-destructive">
            {(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
              'Could not analyze impact'}
          </p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  data.severity === 'critical' || data.severity === 'high'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                )}
              >
                <Target className="mr-1 h-3 w-3" /> {data.severity} {data.category}
              </Badge>
              {data.entrypoint_reachable ? (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                  Reachable from an entry point
                </Badge>
              ) : (
                <Badge variant="outline">Not wired to an entry point</Badge>
              )}
              {data.callers.length > 0 && (
                <Badge variant="outline">{data.callers.length} in-repo caller(s)</Badge>
              )}
            </div>

            <div className="rounded-xl border bg-red-500/5 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
                <Siren className="h-3.5 w-3.5" /> Worst realistic outcome
              </p>
              <p className="text-sm leading-relaxed">{data.worst_case}</p>
            </div>

            <ul className="space-y-2">
              {data.why_it_matters.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {data.callers.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Who reaches this code
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.callers.slice(0, 12).map((caller) => (
                    <code key={caller} className="rounded-md bg-muted px-2 py-1 text-xs">
                      {caller}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {data.sink && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Where it lands
                </p>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">
                  <span className="text-muted-foreground">
                    {data.sink.file}:{data.sink.line_start}
                  </span>{' '}
                  — {data.sink.description}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-primary/5 p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Fix direction
              </p>
              <p className="text-sm leading-relaxed">{data.fix_direction}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
