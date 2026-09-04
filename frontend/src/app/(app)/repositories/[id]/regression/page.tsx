'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { auditService } from '@/services/api';
import { useScans } from '@/hooks/useScans';
import { useRepository } from '@/hooks/useRepositories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, ArrowRight, GitCommit, SearchX } from 'lucide-react';
import type { RegressionReport, RegressionItem } from '@/types/api';

const STATE_META: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  resolved: { label: 'Resolved', cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  still_present: { label: 'Still present', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  reintroduced: { label: 'Reintroduced', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  severity_changed: { label: 'Severity changed', cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
};

function Row({ item }: { item: RegressionItem }) {
  const [open, setOpen] = useState(false);
  const meta = STATE_META[item.state] ?? STATE_META.still_present;
  return (
    <div className="rounded-lg border">
      <button className="w-full text-left px-4 py-3 hover:bg-muted/40 flex flex-col gap-1.5" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
          <Badge variant="outline" className="font-mono text-[10px]">{item.severity}</Badge>
          <span className="text-sm font-medium">{item.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{item.file_path}:{item.line_start ?? '?'}</span>
          {item.function_name && <span>· {item.function_name.split(':').pop()}</span>}
          {item.rule && <span>· {item.rule}</span>}
          <span className="ml-auto">{(item.confidence * 100).toFixed(0)}% · {item.status}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-sm">
          {item.before && (
            <div className="rounded-lg border border-muted p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Previous scan — {item.before.file_path}:{item.before.line_start ?? '?'} · {item.before.severity} / {item.before.status}
              </p>
              {(item.before.evidence ?? []).slice(0, 3).map((ev, i) => (
                <p key={i} className="text-xs text-muted-foreground">{ev.description}</p>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-muted p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Current scan — {item.file_path}:{item.line_start ?? '?'}
            </p>
            {(item.evidence ?? []).slice(0, 3).map((ev, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {ev.kind}: {ev.description}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegressionPage() {
  const params = useParams();
  const id = params.id as string;
  const repo = useRepository(id);
  const scans = useScans(id);
  const completed = useMemo(
    () => (scans.data ?? []).filter((s) => s.status === 'completed').sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [scans.data]
  );

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFile, setFilterFile] = useState('');

  const effectiveFrom = fromId || completed[1]?.id || '';
  const effectiveTo = toId || completed[0]?.id || '';

  const reportQuery = useQuery({
    queryKey: ['regression-compare', id, effectiveFrom, effectiveTo],
    queryFn: () =>
      auditService.regression(id, { from: effectiveFrom || undefined, to: effectiveTo || undefined }),
    enabled: completed.length >= 2,
    retry: false,
  });

  const report = reportQuery.data as RegressionReport | undefined;

  const categories = useMemo(
    () => Array.from(new Set((report?.items ?? []).map((i) => i.category))),
    [report]
  );
  const files = useMemo(
    () => Array.from(new Set((report?.items ?? []).map((i) => i.file_path))).slice(0, 30),
    [report]
  );

  const filtered = useMemo(() => {
    let rows = report?.items ?? [];
    if (filterState !== 'all') rows = rows.filter((i) => i.state === filterState);
    if (filterSeverity !== 'all') rows = rows.filter((i) => i.severity === filterSeverity);
    if (filterCategory !== 'all') rows = rows.filter((i) => i.category === filterCategory);
    if (filterFile) rows = rows.filter((i) => i.file_path.includes(filterFile));
    return rows;
  }, [report, filterState, filterSeverity, filterCategory, filterFile]);

  const summary = report?.summary ?? {
    new: report?.new.length ?? 0,
    resolved: report?.resolved.length ?? 0,
    still_present: report?.still_present.length ?? 0,
    reintroduced: report?.reintroduced.length ?? 0,
    severity_changed: report?.changed_severity.length ?? 0,
    status_changed: report?.changed_status.length ?? 0,
  };

  const filterCls =
    'h-9 rounded-lg border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href={`/repositories/${id}`} className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1 w-fit">
          ← Back to {repo.data?.name ?? 'repository'}
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scan comparison</h1>
            <p className="text-muted-foreground mt-1">
              What changed between two scans of this repository — findings matched by stable evidence fingerprints,
              never by database id.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {scans.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading scans…
            </div>
          ) : completed.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Need at least two completed scans to compare. Run a second scan on this repository and come back.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <GitCommit className="h-3 w-3" /> Base scan (earlier)
                </label>
                <select className={filterCls + ' w-full'} value={effectiveFrom} onChange={(e) => setFromId(e.target.value)}>
                  {completed.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      Scan {completed.length - i} · {s.configuration} · {new Date(s.created_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <GitCommit className="h-3 w-3" /> Head scan (later)
                </label>
                <select className={filterCls + ' w-full'} value={effectiveTo} onChange={(e) => setToId(e.target.value)}>
                  {completed.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      Scan {completed.length - i} · {s.configuration} · {new Date(s.created_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {reportQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Comparing scans…
          </CardContent>
        </Card>
      ) : reportQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-destructive">
            {(reportQuery.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
              'Could not compare the scans'}
          </CardContent>
        </Card>
      ) : report ? (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            {[
              { label: 'Resolved', value: summary.resolved, cls: 'text-green-600 dark:text-green-400' },
              { label: 'New', value: summary.new, cls: 'text-red-600 dark:text-red-400' },
              { label: 'Still present', value: summary.still_present, cls: 'text-amber-600 dark:text-amber-400' },
              { label: 'Reintroduced', value: summary.reintroduced, cls: 'text-orange-600 dark:text-orange-400' },
              { label: 'Severity changed', value: summary.severity_changed, cls: 'text-purple-600 dark:text-purple-400' },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5">
                  <div className={`text-3xl font-bold ${s.cls}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(report.moved?.length ?? 0) > 0 && (
            <Card className="border-purple-500/40">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <ArrowRight className="h-4 w-4" /> Moved-code matches ({report.moved?.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {report.moved?.map((m, i) => (
                  <Badge key={i} variant="outline" className="font-mono text-[10px]" title={m.reason}>
                    {m.file_path} :{m.line_before ?? '?'}→:{m.line_after ?? '?'}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-sm">Comparison rows ({filtered.length})</CardTitle>
              <div className="flex flex-wrap gap-2">
                <select className={filterCls} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                  <option value="all">All states</option>
                  {Object.entries(STATE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select className={filterCls} value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                  <option value="all">All severities</option>
                  {['critical', 'high', 'medium', 'low', 'info'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select className={filterCls} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  className={filterCls + ' min-w-[140px] font-mono'}
                  placeholder="Filter by file…"
                  value={filterFile}
                  onChange={(e) => setFilterFile(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <SearchX className="h-8 w-8 opacity-50" />
                  <p className="text-sm">No findings match the current filters.</p>
                </div>
              ) : (
                filtered.map((item) => <Row key={`${item.state}-${item.external_id}`} item={item} />)
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
