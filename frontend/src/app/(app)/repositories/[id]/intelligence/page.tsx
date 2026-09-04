'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRepository } from '@/hooks/useRepositories';
import { useIntelligence } from '@/hooks/useIntelligence';
import { ArchitectureDiagram } from '@/components/intelligence/architecture-diagram';
import { QueryConsole } from '@/components/intelligence/query-console';
import { ArchitectureSmells } from '@/components/intelligence/architecture-smells';
import { HealthTimeline } from '@/components/intelligence/health-timeline';
import {
  Activity,
  ArrowLeft,
  Bug,
  FileText,
  GitBranch,
  HeartPulse,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileHealth, GitInsights, GitFileStats } from '@/types/api';

function scoreColor(score: number): string {
  if (score <= 4) return 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/25';
  if (score <= 7) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25';
  return 'bg-green-500/10 text-green-600 dark:text-green-400 ring-green-500/25';
}

function lensBadge(lens: string) {
  const map: Record<string, string> = {
    defect_risk: 'bg-red-500/10 text-red-600 dark:text-red-400',
    maintainability: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    performance: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };
  return map[lens] ?? 'bg-muted text-muted-foreground';
}

function ScoreRing({ score }: { score: number }) {
  const color = score <= 4 ? 'text-red-500' : score <= 7 ? 'text-amber-500' : 'text-green-500';
  return <span className={cn('font-display text-xl font-semibold tabular-nums', color)}>{score.toFixed(1)}</span>;
}

function HealthSection({ files, avg, distribution }: { files: FileHealth[]; avg: number | null; distribution: Record<string, number> }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => files.filter((f) => f.path.toLowerCase().includes(query.toLowerCase())),
    [files, query]
  );
  const worst = [...files].sort((a, b) => a.score - b.score).slice(0, 6);
  const buckets = [
    { label: '1–3', count: distribution['1-3'] ?? 0, cls: 'bg-red-500' },
    { label: '4–6', count: distribution['4-6'] ?? 0, cls: 'bg-amber-500' },
    { label: '7–8', count: distribution['7-8'] ?? 0, cls: 'bg-emerald-500' },
    { label: '9–10', count: distribution['9-10'] ?? 0, cls: 'bg-green-500' },
  ];
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average health</CardTitle>
            <HeartPulse className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={cn('font-display text-3xl font-semibold', (avg ?? 0) <= 6 ? 'text-amber-500' : 'text-green-600 dark:text-green-400')}>
              {avg?.toFixed(1) ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">/ 10 across {files.length} files</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Score distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {buckets.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-10 text-xs tabular-nums text-muted-foreground">{b.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', b.cls)} style={{ width: `${(b.count / total) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{b.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {worst.some((f) => f.issues.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Concrete fixes, ranked</CardTitle>
            <CardDescription>Deterministic detectors name the exact refactoring — copy the plan into any agent.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[...worst]
              .filter((f) => f.issues.length > 0)
              .slice(0, 4)
              .map((f) => (
                <div key={f.path} className="rounded-xl border bg-card/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <code className="truncate text-xs font-medium">{f.path}</code>
                    <ScoreRing score={f.score} />
                  </div>
                  <ul className="mt-3 space-y-2">
                    {f.issues.slice(0, 2).map((issue) => (
                      <li key={issue.detector} className="text-sm">
                        <span className={cn('mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', lensBadge(issue.lens))}>
                          {issue.lens.replace('_', ' ')}
                        </span>
                        <span className="font-medium">{issue.title}</span>
                        <p className="mt-0.5 text-xs text-muted-foreground">{issue.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">All files</CardTitle>
          <Input
            placeholder="Filter files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-56 h-8 text-sm"
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((f) => (
              <div key={f.path} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ring-1', scoreColor(f.score))}>
                    {f.score.toFixed(1)}
                  </span>
                  <div className="min-w-0">
                    <code className="block truncate text-sm font-medium">{f.path}</code>
                    <p className="text-xs text-muted-foreground">
                      {f.lines} lines · {f.symbols} symbols · {f.language}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {(['defect_risk', 'maintainability', 'performance'] as const).map((lens) => (
                    <span key={lens} className={cn('rounded-md px-1.5 py-0.5 tabular-nums', lensBadge(lens))} title={lens}>
                      {f.lenses[lens].toFixed(1)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No files match.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GitSection({ git }: { git: GitInsights }) {
  if (!git.available) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="mb-1 font-medium">No git history available</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {git.reason === 'no_git_history'
              ? 'Archives and ZIP uploads carry no history. Import via a GitHub/GitLab/git URL to unlock hotspots, ownership and co-change analytics.'
              : 'Git history could not be read for this repository.'}
          </p>
        </CardContent>
      </Card>
    );
  }
  const hotspots = git.hotspots ?? [];
  const authors = git.top_authors ?? [];
  const coChange = git.co_change ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commits analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">{git.commits_analyzed ?? 0}</div>
            <p className="text-xs text-muted-foreground">{git.commits_last_30d ?? 0} in the last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active authors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">{git.authors ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {authors.slice(0, 3).map((a) => a.name).join(', ') || '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bus factor risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">
              {(git.bus_factor_worst ?? []).filter((f) => f.bus_factor <= 1.5).length}
            </div>
            <p className="text-xs text-muted-foreground">files owned by a single author</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hotspots — where change and bug fixes concentrate</CardTitle>
          <CardDescription>Churn weighted by recency + commits whose subjects match fix/bug/repair patterns.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {hotspots.map((f: GitFileStats) => (
              <div key={f.path} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <code className="min-w-0 flex-1 truncate text-sm font-medium">{f.path}</code>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> {f.churn.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bug className="h-3.5 w-3.5" /> {f.bug_fixes} fixes
                  </span>
                  <Badge variant="outline" className="tabular-nums">
                    {f.hotspot_score.toFixed(1)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Ownership & bus factor
            </CardTitle>
            <CardDescription>Files where a single author holds the majority of commits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(git.bus_factor_worst ?? []).slice(0, 8).map((f: GitFileStats) => (
              <div key={f.path} className="flex items-center gap-3 text-sm">
                <code className="min-w-0 flex-1 truncate">{f.path}</code>
                <span className="text-xs text-muted-foreground">{f.top_author}</span>
                <span className="w-24 rounded-full bg-muted p-0.5">
                  <span
                    className="block h-2 rounded-full bg-primary"
                    style={{ width: `${f.top_author_share * 100}%` }}
                  />
                </span>
                <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                  bus {f.bus_factor.toFixed(1)}
                </span>
              </div>
            ))}
            {(git.bus_factor_worst ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No ownership data.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Co-change coupling</CardTitle>
            <CardDescription>Files that change together — coupling imports don&apos;t show.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {coChange.map((pair) => (
              <div key={pair.files.join('|')} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <code className="min-w-0 flex-1 truncate">{pair.files[0]}</code>
                <span className="text-muted-foreground">⇄</span>
                <code className="min-w-0 flex-1 truncate text-right">{pair.files[1]}</code>
                <Badge variant="outline" className="shrink-0 tabular-nums">{pair.co_changes}×</Badge>
              </div>
            ))}
            {coChange.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No co-change pairs detected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WikiSection({ repoId }: { repoId: string }) {
  const { data, prose } = useIntelligence(repoId);
  const pages = useMemo(() => data?.wiki.pages ?? [], [data]);
  const [selected, setSelected] = useState<string | null>(pages[0]?.path ?? null);
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => pages.filter((p) => p.path.toLowerCase().includes(query.toLowerCase())),
    [pages, query]
  );
  const activePath = selected ?? pages[0]?.path ?? null;
  const page = pages.find((p) => p.path === activePath) ?? null;
  const proseResult = prose.data?.file_path === page?.path ? prose.data : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">Files</CardTitle>
          <Input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </CardHeader>
        <CardContent className="max-h-[560px] space-y-0.5 overflow-y-auto p-2">
          {filtered.map((p) => (
            <button
              key={p.path}
              onClick={() => setSelected(p.path)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                p.path === activePath ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{p.path}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">No files.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 font-mono text-base">
              <FileText className="h-4 w-4 text-primary" />
              <span className="truncate">{page?.path ?? 'Select a file'}</span>
            </CardTitle>
            {page && (
              <CardDescription className="mt-1">
                {page.language} · {page.summary}
              </CardDescription>
            )}
          </div>
          {page && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => prose.mutate(page.path)}
              disabled={prose.isPending}
            >
              {prose.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {proseResult ? 'Regenerate AI prose' : 'Generate AI prose'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!page && <p className="py-10 text-center text-sm text-muted-foreground">Select a file to read its wiki page.</p>}

          {page && proseResult && (
            <div className="rounded-xl border bg-card/60 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                AI-written · {proseResult.provider} {proseResult.model}
              </p>
              <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">{proseResult.content}</div>
            </div>
          )}

          {page && !proseResult && page.docstring && (
            <div className="rounded-xl bg-muted/60 p-4 text-sm italic text-muted-foreground">
              “{page.docstring}”
            </div>
          )}

          {page && (
            <>
              {page.symbols.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Symbols</p>
                  <div className="divide-y rounded-xl border">
                    {page.symbols.map((s) => (
                      <div key={`${s.name}-${s.line_start}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <Badge variant="outline" className="w-20 justify-center capitalize">{s.kind}</Badge>
                        <code className="min-w-0 flex-1 truncate font-medium">{s.name}</code>
                        {s.params && <span className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">{s.params}</span>}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">L{s.line_start}–{s.line_end}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {page.imports.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Imports</p>
                    <div className="flex flex-wrap gap-1.5">
                      {page.imports.map((imp) => (
                        <code key={imp} className="rounded-md bg-muted px-2 py-1 text-xs">{imp}</code>
                      ))}
                    </div>
                  </div>
                )}
                {page.top_calls.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Top calls</p>
                    <div className="flex flex-wrap gap-1.5">
                      {page.top_calls.map((c) => (
                        <code key={c.callee} className="rounded-md bg-muted px-2 py-1 text-xs">
                          {c.callee} <span className="text-muted-foreground">×{c.calls}</span>
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {page.imports.length === 0 && page.top_calls.length === 0 && (
                <p className="text-sm text-muted-foreground">No imports or calls recorded for this file.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntelligencePage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params.id as string;
  const { data: repository, isLoading: repoLoading } = useRepository(repoId);
  const { data, isLoading, isError, error, refresh } = useIntelligence(repoId);

  if (repoLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="h-28 animate-pulse rounded bg-muted/60" /></Card>
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    );
  }

  const notIngested = isError && error instanceof Error && error.message.includes('ingested');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/repositories/${repoId}`}
            className="mb-2 inline-block text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Back to {repository?.name ?? 'repository'}
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <GitBranch className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Repository intelligence</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {repository?.name} · deterministic health, git analytics, architecture & wiki
                {data?.generated_at && (
                  <span> · indexed {new Date(data.generated_at).toLocaleString()}</span>
                )}
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          {refresh.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-index
        </Button>
      </div>

      {isError && !notIngested && (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-sm text-destructive">
            Intelligence could not be computed: {error instanceof Error ? error.message : 'unknown error'}
          </CardContent>
        </Card>
      )}

      {notIngested && (
        <Card>
          <CardContent className="py-14 text-center">
            <GitBranch className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="mb-1 font-medium">Nothing indexed yet</h3>
            <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
              Run a scan first so the working copy exists — then the intelligence index (health, git, architecture, wiki) is built from it.
            </p>
            <Button onClick={() => router.push(`/scans/new?repo=${repoId}`)}>Run first scan</Button>
          </CardContent>
        </Card>
      )}

      {data && data.status === 'ready' && (
        <Tabs defaultValue="health">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="git">Git</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="wiki">Wiki</TabsTrigger>
            <TabsTrigger value="ask">Ask</TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="mt-4 space-y-4">
            <HealthSection
              files={data.health.files ?? []}
              avg={data.health.average_score}
              distribution={data.health.distribution ?? {}}
            />
            <HealthTimeline repositoryId={repoId} />
          </TabsContent>

          <TabsContent value="git" className="mt-4">
            <GitSection git={data.git} />
          </TabsContent>

          <TabsContent value="architecture" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-primary" /> Dependency architecture
                </CardTitle>
                <CardDescription>
                  Top-level modules laid out left → right by dependency depth; arrows show import relationships.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ArchitectureDiagram graph={data.architecture} />
              </CardContent>
            </Card>
            <ArchitectureSmells repositoryId={repoId} />
          </TabsContent>

          <TabsContent value="wiki" className="mt-4">
            <WikiSection repoId={repoId} />
          </TabsContent>

          <TabsContent value="ask" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4 text-primary" />
                Ask questions about {repository?.name} — answered from the computed index.
              </div>
              <QueryConsole repositoryId={repoId} />
            </div>
          </TabsContent>
        </Tabs>      )}
    </div>
  );
}
