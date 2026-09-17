'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VerificationSection } from '@/components/patch-verification';
import { ImpactPanel } from '@/components/findings/impact-panel';
import { FindingChat } from '@/components/findings/finding-chat';
import { PatchQualityBadge } from '@/components/findings/patch-quality-badge';
import { ProofOfFixPanel } from '@/components/findings/proof-of-fix';
import { useFinding, useGenerateFix } from '@/hooks/useFindings';
import { FindingFeedbackBar } from '@/components/app/finding-feedback-bar';
import { usePatches } from '@/hooks/usePatches';
import { useGeneratedTest, useCounterexample, useValidateFinding } from '@/hooks/useAudit';
import { getApiErrorMessage } from '@/lib/api-error';
import { useState } from 'react';
import {
  Bug,
  AlertTriangle,
  Shield,
  FileCode,
  Copy,
  CheckCircle,
  XCircle,
  Search,
  ArrowUpRight,
  Clipboard,
  Clock,
  Loader2,
  Wand2,
  TestTube,
  ShieldCheck,
  FlaskConical,
  Compass,
  MessageSquare,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { RunTestResponse } from '@/types/api';

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
  const generateFix = useGenerateFix();
  const { generate: generateTest, run: runTest } = useGeneratedTest();
  const counterexample = useCounterexample();
  const validateFinding = useValidateFinding();
  const [generated, setGenerated] = useState<{ id: string; test_code: string; generated_by: string } | null>(null);
  const [runResult, setRunResult] = useState<RunTestResponse | null>(null);
  const fixPatch = (patches ?? []).find((p) => ['verified', 'applied', 'candidate'].includes(p.status));

  const executeTest = (patchId?: string) => {
    if (!generated) return;
    runTest.mutate(
      { testId: generated.id, patchId },
      {
        onSuccess: (data: RunTestResponse) => {
          setRunResult(data);
          if (data.proof_of_fix?.verdict === 'VERIFIED_FIX_PROOF') {
            toast.success('Verified fix proof — test fails on vulnerable code, passes with the patch');
          } else if (data.result?.outcome === 'TEST_REPRODUCES_BUG') {
            toast.success('Test reproduced the defect (fails on this code, as expected for a vulnerable finding)');
          } else if (data.result?.outcome === 'TEST_DOES_NOT_REPRODUCE') {
            toast.success('Test passed — defect not present on this code');
          } else if (data.result?.outcome === 'TEST_FAILED_TO_EXECUTE') {
            toast.error('Test failed to execute — infrastructure issue, not a defect signal');
          }
        },
      }
    );
  };

  const [proof, setProof] = useState<{ counterexample: import('@/types/api').CounterexampleProof | null } | null>(null);
  const [validation, setValidation] = useState<import('@/types/api').FindingValidationResult | null>(null);

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
      <FindingFeedbackBar findingId={finding.id} />
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="evidence">Evidence ({finding.evidence?.length || 0})</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
          <TabsTrigger value="patches">Patches ({patches?.length || 0})</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="ask">Ask</TabsTrigger>
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

        <TabsContent value="impact" className="mt-4">
          <ImpactPanel findingId={id} />
        </TabsContent>

        <TabsContent value="ask" className="mt-4">
          <FindingChat findingId={id} />
        </TabsContent>

        <TabsContent value="patches" className="space-y-4">
          <ProofOfFixPanel findingId={id} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Candidate Patches</CardTitle>
              <Button
                size="sm"
                onClick={() => generateFix.mutate(id)}
                disabled={generateFix.isPending}
              >
                {generateFix.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Generate Fix
              </Button>
            </CardHeader>
            {generateFix.isError && (
              <div className="px-6 pb-2">
                <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
                  {getApiErrorMessage(generateFix.error)}
                </p>
              </div>
            )}
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
                  <p className="text-muted-foreground">
                    Generate a candidate fix to see a reviewable diff. The patch is never applied
                    to the original repository — verification runs on an isolated copy.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patches?.map((patch) => (
                    <div key={patch.id} className="border rounded-lg overflow-hidden">
                      <div className="p-4 bg-muted/50 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${cn(
                            patch.status === 'verified' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                            patch.status === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                            patch.status === 'applied' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                          )}`}>
                            <Shield className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{patch.status}</p>
                            <p className="text-sm text-muted-foreground">Generated by: {patch.generated_by}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <PatchQualityBadge patchId={patch.id} />
                          <Badge variant="outline" className={cn(
                            patch.status === 'verified' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                            patch.status === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                            patch.status === 'applied' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            patch.status === 'candidate' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                            'bg-gray-500/10 text-gray-600 dark:text-gray-400'
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
                      <VerificationSection patch={patch} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          {/* Regression test generation */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-4 w-4" /> Automated regression test
              </CardTitle>
              <div className="flex items-center gap-2">
                {generated && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeTest()}
                      disabled={runTest.isPending}
                    >
                      {runTest.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FlaskConical className="mr-2 h-4 w-4" />
                      )}
                      Run test
                    </Button>
                    {fixPatch && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeTest(fixPatch.id)}
                        disabled={runTest.isPending}
                        title="Run this reproduction test against the generated fix (Proof-of-Fix)"
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Run against fix
                      </Button>
                    )}
                  </>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    generateTest.mutate(id, {
                      onSuccess: (data) => {
                        setGenerated({ id: data.id, test_code: data.test_code, generated_by: data.generated_by });
                        setRunResult(null);
                        toast.success('Regression test generated');
                      },
                    });
                  }}
                  disabled={generateTest.isPending}
                >
                  {generateTest.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Generate test
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A contract test that asserts the vulnerable pattern is gone. It FAILS on the
                vulnerable code (demonstrating the defect) and PASSES after a real fix — no
                runtime, fixtures or network required.
              </p>
              {generated ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{generated.generated_by}</Badge>
                  </div>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto max-h-72"><code>{generated.test_code}</code></pre>
                  {runResult && (() => {
                    const outcome = runResult.result?.outcome;
                    const color =
                      outcome === 'TEST_DOES_NOT_REPRODUCE'
                        ? 'border-green-500/40 bg-green-500/5'
                        : outcome === 'TEST_FAILED_TO_EXECUTE'
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-red-500/40 bg-red-500/5';
                    return (
                      <div className={`rounded-lg border p-4 ${color}`}>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-sm font-medium">
                            {outcome === 'TEST_DOES_NOT_REPRODUCE' && '✓ Test passed — defect not present'}
                            {outcome === 'TEST_REPRODUCES_BUG' && '✗ Test reproduced the defect (failed on vulnerable code)'}
                            {outcome === 'TEST_FAILED_TO_EXECUTE' && '⚠ Test failed to execute (not a defect signal)'}
                            {!outcome && (runResult.status === 'passed' ? '✓ Test passed' : '✗ Test failed')}
                          </span>
                          {runResult.result?.patch_applied && (
                            <Badge variant="outline">ran against fix{runResult.result.patched_files?.length ? ` (${runResult.result.patched_files.join(', ')})` : ''}</Badge>
                          )}
                          {runResult.proof_of_fix?.verdict === 'VERIFIED_FIX_PROOF' && (
                            <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              VERIFIED FIX PROOF
                            </Badge>
                          )}
                        </div>
                        {runResult.proof_of_fix?.explanation && (
                          <p className="text-xs text-muted-foreground mb-2">{runResult.proof_of_fix.explanation}</p>
                        )}
                        {runResult.result?.outcome_detail && (
                          <p className="text-xs text-muted-foreground mb-2">{runResult.result.outcome_detail}</p>
                        )}
                        <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap">
                          {String(runResult.result?.summary ?? '')}
                        </pre>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No test generated yet for this finding.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Counterexample / proof-of-absence */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Counterexample check (proof-of-absence)
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  counterexample.mutate(id, {
                    onSuccess: (data) => setProof(data),
                  });
                }}
                disabled={counterexample.isPending}
              >
                {counterexample.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Validate
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Walks the source → sink path looking for a sanitizer (escaping, parameterization,
                validation, type coercion). If one guards the sink, the finding cannot manifest on
                that path — negative evidence against the claim.
              </p>
              {counterexample.isError && (
                <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
                  {getApiErrorMessage(counterexample.error)}
                </p>
              )}
              {proof && (
                proof.counterexample ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Counterexample found — the claim may not hold on this path
                    </p>
                    <p className="text-sm">{proof.counterexample.explanation}</p>
                    <div className="grid gap-2 text-xs font-mono bg-background rounded p-3 border">
                      <p className="text-green-600 dark:text-green-400">
                        {proof.counterexample.sanitizer_line}: {proof.counterexample.sanitizer_snippet}
                      </p>
                      <p className="text-red-600 dark:text-red-400">
                        {proof.counterexample.sink_line}: {proof.counterexample.sink_snippet}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-4">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      No sanitizer on the path — the claim stands
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      No counterexample found between source and sink.
                    </p>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Full validation battery (counterexample-based) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Validation battery
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  validateFinding.mutate(id, { onSuccess: setValidation });
                }}
                disabled={validateFinding.isPending}
              >
                {validateFinding.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Clipboard className="mr-2 h-4 w-4" />
                )}
                Run validation
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The validator opposes the claim: it checks the source → sink chain, sanitizer and
                parameterization guards, authorization, exception handling, deterministic rules and
                test references — then decides VERIFIED / PROBABLE / REJECTED with confidence. Every
                run is logged for research metrics (false-positive reduction).
              </p>
              {validateFinding.isError && (
                <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
                  {getApiErrorMessage(validateFinding.error)}
                </p>
              )}
              {validation && (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          validation.final_status === 'verified'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                            : validation.final_status === 'rejected'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }
                      >
                        {validation.final_status.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium">
                        {Math.round(validation.confidence * 100)}% confidence
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        before: {validation.original_status}
                      </span>
                    </div>
                    <p className="text-sm">{validation.explanation}</p>
                    <p className="text-xs text-muted-foreground font-mono">{validation.claim}</p>
                    {validation.rule && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {validation.rule}
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-lg border divide-y">
                    {validation.checks.map((check) => (
                      <div key={check.key} className="flex items-start gap-2.5 px-4 py-2.5">
                        {check.passed ? (
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{check.label}</p>
                          <p className="text-xs text-muted-foreground">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {validation.contradicting_evidence.length > 0 && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
                        Contradicting evidence
                      </p>
                      {validation.contradicting_evidence.map((c, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • {c.label}: {c.detail}
                        </p>
                      ))}
                    </div>
                  )}
                  {validation.supporting_evidence.length > 0 && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-green-600 dark:text-green-400">
                        Supporting evidence
                      </p>
                      {validation.supporting_evidence.map((s, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • {s.label}: {s.detail}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Validation run {validation.validation_run_id.slice(0, 8)} — recorded for research metrics.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}