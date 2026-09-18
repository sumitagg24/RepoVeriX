'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEvidenceGraph } from '@/hooks/useAudit';
import {
  EVIDENCE_LEGEND,
  EvidenceGraphDiagram,
  kindColor,
} from '@/components/audit/evidence-graph-diagram';
import { GitBranch, Loader2, Network, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function EvidenceGraphPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useEvidenceGraph(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href={`/repositories/${id}`}
            className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
          >
            ← Back to Repository
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h1 className="type-page-title">Evidence Graph</h1>
              <p className="text-muted-foreground mt-1">
                Findings → evidence chains → files, as a queryable graph
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Building graph…
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-destructive">
            {(error as Error).message ||
              ((error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                'Could not load the evidence graph')}
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Findings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.finding_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Evidence Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.nodes.filter((n) => n.kind === 'evidence').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Edges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.edges.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> Graph
              </CardTitle>
              <Badge variant="outline">{data.configuration.replace('_', ' ')} scan</Badge>
            </CardHeader>
            <CardContent>
              <EvidenceGraphDiagram graph={data} />
              {/* The key is derived from the diagram's own kind→token map, so it
                  cannot describe colours the graph does not paint. */}
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {EVIDENCE_LEGEND.map((entry) => (
                  <span key={entry.kind} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: kindColor(entry.kind) }}
                      aria-hidden="true"
                    />
                    {entry.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}