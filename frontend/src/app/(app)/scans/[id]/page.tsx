'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useScan } from '@/hooks/useScans';
import { useFindings } from '@/hooks/useFindings';
import { Search, Loader2, CheckCircle, AlertTriangle, Clock, X, Terminal, Bug, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const scanStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

const scanStatusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

export default function ScanDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: scan, isLoading: scanLoading } = useScan(id);
  const { data: findings, isLoading: findingsLoading } = useFindings({ scan_id: id, limit: 20 });

  if (scanLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="h-20 bg-muted animate-pulse rounded" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="text-center py-12">
        <Terminal className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-medium mb-2">Scan not found</h3>
        <Link href="/scans">
          <Button variant="outline" className="mt-4">Back to Scans</Button>
        </Link>
      </div>
    );
  }

  const recentFindings = findings?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/scans" className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
            ← Back to Scans
          </Link>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${scanStatusColors[scan.status]}`}>
              {scanStatusIcons[scan.status]}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{scan.configuration.replace('_', ' ').toUpperCase()}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                <Badge variant="outline" className={scanStatusColors[scan.status]}>
                  {scanStatusIcons[scan.status]}
                  {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scan.status === 'running' && (
            <Button variant="destructive" onClick={() => {}} disabled>
              <X className="mr-2 h-4 w-4" />
              Cancel Scan
            </Button>
          )}
          {scan.status === 'pending' && (
            <Button variant="outline">
              <Loader2 className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scan.started_at && scan.finished_at
                ? Math.round((new Date(scan.finished_at).getTime() - new Date(scan.started_at).getTime()) / 1000 / 60) + ' min'
                : scan.started_at
                ? 'Running...'
                : 'Not started'}
            </div>
            <p className="text-xs text-muted-foreground">Total scan time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Analysis Runs</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scan.analysis_runs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Pipeline stages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Findings</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{findings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Issues discovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Started</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sm">
              {scan.started_at ? formatDistanceToNow(new Date(scan.started_at), { addSuffix: true }) : 'Not started'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {scan.error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 bg-destructive/5 text-destructive">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Scan Error</p>
                <p className="text-sm mt-1">{scan.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="findings">Findings ({findings?.length || 0})</TabsTrigger>
          <TabsTrigger value="runs">Analysis Runs ({scan.analysis_runs?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scan Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Scan ID</dt>
                    <dd className="font-mono text-sm break-all">{scan.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Repository ID</dt>
                    <dd className="font-mono text-sm break-all">{scan.repository_id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Configuration</dt>
                    <dd className="capitalize">{scan.configuration.replace('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Status</dt>
                    <dd>
                      <Badge variant="outline" className={scanStatusColors[scan.status]}>
                        {scanStatusIcons[scan.status]}
                        {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Created</dt>
                    <dd>{new Date(scan.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Started</dt>
                    <dd>{scan.started_at ? new Date(scan.started_at).toLocaleString() : 'Not started'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Finished</dt>
                    <dd>{scan.finished_at ? new Date(scan.finished_at).toLocaleString() : 'Not finished'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">Summary</dt>
                    <dd className="font-mono text-sm bg-muted p-3 rounded break-all">
                      {scan.summary ? JSON.stringify(scan.summary, null, 2) : 'No summary available'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">LLM Token Usage</dt>
                    <dd className="font-mono text-sm bg-muted p-3 rounded break-all">
                      {scan.llm_token_usage ? JSON.stringify(scan.llm_token_usage, null, 2) : 'Not available'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href={`/findings?scan_id=${scan.id}`}>
                    <Bug className="h-8 w-8" />
                    <span>View All Findings</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href={`/scans/new?repo=${scan.repository_id}`}>
                    <Search className="h-8 w-8" />
                    <span>Rescan Repository</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href={`/repositories/${scan.repository_id}`}>
                    <Terminal className="h-8 w-8" />
                    <span>View Repository</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="findings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Findings</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/findings?scan_id=${scan.id}`}>View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {findingsLoading ? (
                <div className="space-y-4 p-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentFindings.length === 0 ? (
                <div className="text-center py-12">
                  <Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No findings yet</h3>
                  <p className="text-muted-foreground">This scan did not discover any issues</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentFindings.map((finding) => (
                    <Link
                      key={finding.id}
                      href={`/findings/${finding.id}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`p-3 rounded-lg flex-shrink-0 ${
                          finding.severity === 'critical' && 'bg-red-500/10 text-red-600 dark:text-red-400' ||
                          finding.severity === 'high' && 'bg-orange-500/10 text-orange-600 dark:text-orange-400' ||
                          finding.severity === 'medium' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' ||
                          finding.severity === 'low' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400' ||
                          'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                        }`}>
                          <Bug className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/findings/${finding.id}`} className="font-medium truncate hover:text-primary">
                              {finding.title}
                            </Link>
                            <Badge variant="outline" className={cn(
                              finding.severity === 'critical' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                              finding.severity === 'high' && 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
                              finding.severity === 'medium' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                              finding.severity === 'low' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                              finding.severity === 'info' && 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                            )}>
                              {finding.severity}
                            </Badge>
                            <Badge variant="outline" className={cn(
                              finding.status === 'verified' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                              finding.status === 'probable' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                              finding.status === 'rejected' && 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                            )}>
                              {finding.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="font-mono truncate max-w-[300px]">{finding.file_path}:{finding.line_start || '?'}</span>
                            <span>{finding.category.replace('_', ' ')}</span>
                            <span>Confidence: {(finding.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {scan.analysis_runs?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analysis runs recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scan.analysis_runs
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((run) => (
                      <div key={run.id} className="p-4 rounded-lg border">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${run.status === 'completed' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : run.status === 'failed' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                              <Terminal className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium capitalize">{run.stage.replace('_', ' ')}</p>
                              <p className="text-sm text-muted-foreground">{run.tool_name || 'No tool specified'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <Badge variant="outline" className={cn(
                              run.status === 'pending' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                              run.status === 'running' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                              run.status === 'completed' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                              run.status === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400'
                            )}>
                              {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                            </Badge>
                            <span>{run.started_at ? formatDistanceToNow(new Date(run.started_at), { addSuffix: true }) : 'Not started'}</span>
                            {run.finished_at && <span>Finished {formatDistanceToNow(new Date(run.finished_at), { addSuffix: true })}</span>}
                          </div>
                        </div>
                        {run.output && (
                          <details className="mt-3">
                            <summary className="text-sm text-muted-foreground cursor-pointer">View Output</summary>
                            <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto max-h-64">{JSON.stringify(run.output, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}