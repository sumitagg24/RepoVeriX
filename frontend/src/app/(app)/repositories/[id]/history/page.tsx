'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, ArrowLeft, GitCompare, History, LineChart, Loader2, Plus } from 'lucide-react';
import { HealthTimeline } from '@/components/intelligence/health-timeline';
import { useIntelligence } from '@/hooks/useIntelligence';
import { useHealthTimeline } from '@/hooks/useAudit';
import { useScans } from '@/hooks/useScans';
import { formatDistanceToNow } from 'date-fns';
import { toneHue } from '@/lib/tone';

export default function RepositoryHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: intelligence } = useIntelligence(id);
  const { data: timeline, isLoading: timelineLoading } = useHealthTimeline(id);
  const { data: scans, isLoading: scansLoading } = useScans(id);

  const health = intelligence?.status === 'ready' ? intelligence.health : null;
  const points = (timeline?.points ?? []).map((p) => ({ ...p, average_score: p.average_score ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/repositories/${id}`}
            className="text-sm text-muted-foreground inline-flex items-center gap-1.5 mb-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Repository
          </Link>
          <h1 className="type-page-title flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" /> Health History
          </h1>
          <p className="text-sm text-muted-foreground">
            Actual recorded scan &amp; health snapshots — historical data is never manufactured.
          </p>
        </div>
        <Button asChild>
          <Link href={`/scans/new?repo=${id}`}>
            <Plus className="mr-2 h-4 w-4" /> New Scan
          </Link>
        </Button>
      </div>

      {/* overview stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.average_score != null ? health.average_score.toFixed(1) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Snapshots recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timelineLoading ? '…' : (timeline?.count ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Scans run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scansLoading ? '…' : (scans?.length ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {points.length >= 2 ? (
                (points[points.length - 1].average_score ?? 0) >= (points[0].average_score ?? 0) ? (
                  <span className={toneHue('verified')}>improving ↗</span>
                ) : (
                  <span className={toneHue('critical')}>declining ↘</span>
                )
              ) : (
                <span className="text-muted-foreground text-lg">not enough data</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {points.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <LineChart className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No health snapshots recorded yet. Run a scan and open the Intelligence page to compute
              the first snapshot.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={`/repositories/${id}/intelligence`}>Open Intelligence</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {points.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Health over time
            </CardTitle>
            <CardDescription>One point per actually recorded intelligence snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthTimeline repositoryId={id} />
            <div className="divide-y rounded-lg border">
              {[...points].reverse().map((point, i) => (
                <div key={`${point.recorded_at}-${i}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-40">
                    {new Date(point.recorded_at).toLocaleString()}
                  </span>
                  <span className="font-medium">{(point.average_score ?? 0).toFixed(1)}</span>
                  {point.commit_sha && (
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-40">
                      {point.commit_sha.slice(0, 10)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{point.files_scored} files scored</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* scans + comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Scan history
          </CardTitle>
          <CardDescription>
            Compare two scans to see resolved, new, still-present and regressed findings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {scansLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading scans…
            </div>
          ) : !scans || scans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No scans for this repository yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {scans.length >= 2 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/repositories/${id}/regression`}>
                      <GitCompare className="mr-2 h-4 w-4" /> Compare scans
                    </Link>
                  </Button>
                ) : (
                  <Badge variant="outline">Run a second scan to enable comparison</Badge>
                )}
              </div>
              <div className="divide-y rounded-lg border">
                {scans.map((scan) => (
                  <div key={scan.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                    <Badge variant="outline">{scan.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {scan.created_at ? formatDistanceToNow(new Date(scan.created_at), { addSuffix: true }) : ''}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{scan.configuration}</span>
                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                      <Link href={`/scans/${scan.id}`}>View scan</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
