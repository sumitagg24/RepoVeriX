'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useArchitectureSmells } from '@/hooks/useAudit';
import { AlertTriangle, GitBranch, Loader2, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

const SMELL_STYLES: Record<string, string> = {
  hub_module: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  dependency_cycle: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  god_module: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  unstable_module: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  orphan_module: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

const SMELL_LABELS: Record<string, string> = {
  hub_module: 'Hub module',
  dependency_cycle: 'Dependency cycle',
  god_module: 'God module',
  unstable_module: 'Unstable module',
  orphan_module: 'Orphan module',
};

export function ArchitectureSmells({ repositoryId }: { repositoryId: string }) {
  const { data, isLoading, isError, error } = useArchitectureSmells(repositoryId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Detecting architecture smells…
        </CardContent>
      </Card>
    );
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          {(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
            'Could not detect architecture smells'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Workflow className="h-4 w-4 text-primary" /> Architecture smell report
          </CardTitle>
          <CardDescription>
            Structural problems computed from the import graph: {data.module_count} modules,{' '}
            {data.edge_count} edges, {data.smell_count} smell(s).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(data.by_type).map(([type, count]) => (
            <Badge key={type} variant="outline" className={SMELL_STYLES[type]}>
              {SMELL_LABELS[type] ?? type}: {count}
            </Badge>
          ))}
          {data.smell_count === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-green-600 dark:text-green-400" /> No smells detected —
              the module structure is healthy.
            </p>
          )}
        </CardContent>
      </Card>

      {data.smells.map((smell, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:gap-4">
            <Badge variant="outline" className={cn('w-fit shrink-0', SMELL_STYLES[smell.smell])}>
              {SMELL_LABELS[smell.smell] ?? smell.smell.replace('_', ' ')} · {smell.severity}
            </Badge>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {smell.modules.map((m) => (
                  <code key={m} className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                    <GitBranch className="h-3 w-3 text-muted-foreground" /> {m}
                  </code>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{smell.detail}</p>
              <p className="text-xs leading-relaxed text-foreground/80">
                <span className="font-semibold">Fix:</span> {smell.remediation}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
