'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinding } from '@/hooks/useFindings';
import { usePatches } from '@/hooks/usePatches';
import {
  Bug,
  AlertTriangle,
  Shield,
  FileCode,
  Copy,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpRight,
  Clipboard,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  info: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

const statusColors: Record<string, string> = {
  verified: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  probable: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  rejected: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

const sourceColors: Record<string, string> = {
  static: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  llm: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  hybrid: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
};

const evidenceKindIcons: Record<string, React.ReactNode> = {
  source_input: <Search className="h-4 w-4" />,
  transformation: <Shield className="h-4 w-4" />,
  sink: <AlertTriangle className="h-4 w-4" />,
  static_analysis: <FileCode className="h-4 w-4" />,
  dependency: <Shield className="h-4 w-4" />,
  test: <CheckCircle className="h-4 w-4" />,
  llm_reasoning: <Bug className="h-4 w-4" />,
  call_relationship: <Search className="h-4 w-4" />,
};

export default function FindingDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: finding, isLoading: findingLoading } = useFinding(id);
  const { data: patches, isLoading: patchesLoading } = usePatches({ finding_id: id });

  if (findingLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <Card><CardContent className="h-64 bg-muted animate-pulse rounded" /></Card>
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="text-center py-12">
        <Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-medium mb-2">Finding not found</h3>
        <Link href="/findings">
          <Button variant="outline" className="mt-4">Back to Findings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/findings" className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
            ← Back to Findings
          </Link>
          <div className="flex items-start gap-4">
            <div className={`p-4 rounded-lg ${severityColors[finding.severity]}`}>
              <Bug className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{finding.title}</h1>
                <Badge variant="outline" className={severityColors[finding.severity]}>
                  {finding.severity}
                </Badge>
                <Badge variant="outline" className={statusColors[finding.status]}>
                  {finding.status === 'verified' && <CheckCircle className="mr-1 h-3 w-3" />}
                  {finding.status === 'rejected' && <XCircle className="mr-1 h-3 w-3" />}
                  {finding.status.charAt(0).toUpperCase() + finding.status.slice(1)}
                </Badge>
                <Badge variant="outline" className={sourceColors[finding.source]}>
                  {finding.source}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {finding.file_path}:{finding.line_start || '?'} - {finding.category.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Clipboard className="h-4 w-4" />
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/scans/${finding.scan_id}`}>
              <ArrowUpRight className="mr-1 h-4 w-4" />
              View Scan
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confidence</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(finding.confidence * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Evidence Nodes</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finding.evidence?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Patches</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patches?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sm">{formatDistanceToNow(new Date(finding.created_at), { addSuffix: true })}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="evidence">Evidence ({finding.evidence?.length || 0})</TabsTrigger>
          <TabsTrigger value="patches">Patches ({patches?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{finding.description}</p>
              </CardContent>
            </Card>

            {finding.impact && (
              <Card>
                <CardHeader>
                  <CardTitle>Impact</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{finding.impact}</p>
                </CardContent>
              </Card>
            )}

            {finding.recommendation && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{finding.recommendation}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Finding ID</dt>
                    <dd className="font-mono text-sm break-all">{finding.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">External ID</dt>
                    <dd className="font-mono text-sm">{finding.external_id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Scan ID</dt>
                    <dd className="font-mono text-sm break-all">{finding.scan_id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Category</dt>
                    <dd className="capitalize">{finding.category.replace('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Severity</dt>
                    <dd>
                      <Badge variant="outline" className={severityColors[finding.severity]}>
                        {finding.severity}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Status</dt>
                    <dd>
                      <Badge variant="outline" className={statusColors[finding.status]}>
                        {finding.status}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Source</dt>
                    <dd>
                      <Badge variant="outline" className={sourceColors[finding.source]}>
                        {finding.source}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Confidence</dt>
                    <dd>{(finding.confidence * 100).toFixed(1)}%</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">File</dt>
                    <dd className="font-mono text-sm truncate max-w-xs">{finding.file_path}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Function</dt>
                    <dd className="font-mono text-sm truncate max-w-xs">{finding.function_name || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Lines</dt>
                    <dd>{finding.line_start ? `${finding.line_start}-${finding.line_end || finding.line_start}` : 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Created</dt>
                    <dd>{new Date(finding.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Updated</dt>
                    <dd>{new Date(finding.updated_at).toLocaleString()}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Evidence Graph</CardTitle>
              <CardDescription>Ordered evidence chain from source to sink</CardDescription>
            </CardHeader>
            <CardContent>
              {finding.evidence?.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No evidence recorded</h3>
                </div>
              ) : (
                <div className="space-y-4">
                  {finding.evidence
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((evidence, index) => (
                      <div key={evidence.id} className="flex gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0 w-12 text-center">
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted mx-auto">
                            {evidenceKindIcons[evidence.kind] || <Search className="h-5 w-5" />}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Step {evidence.order_index + 1}</div>
                        </div>
                        <div className="flex-1 border-l-2 border-muted/50 pl-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="capitalize">{evidence.kind.replace('_', ' ')}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {evidence.file_path ? `${evidence.file_path}:${evidence.line_start || '?'}` : 'No location'}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm">{evidence.description}</p>
                          {evidence.snippet && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">View Code Snippet</summary>
                              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto max-h-48"><code>{evidence.snippet}</code></pre>
                            </details>
                          )}
                          {Object.keys(evidence.metadata).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">View Metadata</summary>
                              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto max-h-48">{JSON.stringify(evidence.metadata, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Candidate Patches</CardTitle>
            </CardHeader>
            <CardContent>
              {patchesLoading ? (
                <div className="space-y-4 p-6">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : patches?.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No patches generated</h3>
                  <p className="text-muted-foreground">Run repair phase to generate candidate fixes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patches?.map((patch) => (
                    <div key={patch.id} className="border rounded-lg overflow-hidden">
                      <div className="p-4 bg-muted/50 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${cn(
                            patch.status === 'verified' && 'bg-green-500/10 text-green-600',
                            patch.status === 'failed' && 'bg-red-500/10 text-red-600',
                            patch.status === 'applied' && 'bg-blue-500/10 text-blue-600',
                            'bg-gray-500/10 text-gray-600'
                          )}`}>
                            <Shield className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{patch.status}</p>
                            <p className="text-sm text-muted-foreground">Generated by: {patch.generated_by}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            patch.status === 'verified' && 'bg-green-500/10 text-green-600',
                            patch.status === 'failed' && 'bg-red-500/10 text-red-600',
                            patch.status === 'applied' && 'bg-blue-500/10 text-blue-600',
                            patch.status === 'candidate' && 'bg-yellow-500/10 text-yellow-600',
                            'bg-gray-500/10 text-gray-600'
                          )}>
                            {patch.status}
                          </Badge>
                        </div>
                      </div>
                      {patch.explanation && (
                        <div className="px-4 py-2 border-b bg-muted/30">
                          <p className="text-sm text-muted-foreground">{patch.explanation}</p>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm">Diff</span>
                          <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(patch.diff)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <pre className="p-3 bg-muted rounded text-xs overflow-x-auto max-h-64"><code>{patch.diff}</code></pre>
                      </div>
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