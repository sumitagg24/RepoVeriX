'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowDownUp,
  ArrowRight,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { SEVERITIES } from '@/lib/evidence';
import { useFindings } from '@/hooks/useFindings';
import { useRepositories } from '@/hooks/useRepositories';
import { useScans } from '@/hooks/useScans';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from '@/components/system/severity-badge';
import { VerdictBadge } from '@/components/system/verdict-badge';
import { ConsoleEmpty, ConsoleSkeleton, Panel, Rule, StageTag } from '@/components/rvx/primitives';
import type { Finding, Repository, Scan } from '@/types/api';

/**
 * Findings explorer.
 *
 * Three panes, one question each:
 *
 *   facets   what slice of the corpus am I looking at
 *   ledger   the slice itself, dense and keyboard-driven
 *   preview  what the selected record actually says
 *
 * Facets are applied server-side (`useFindings` takes severity/status/category/
 * repository), while the counts on the rail come from a separate unfiltered
 * window, so the numbers do not collapse to whatever is currently selected.
 * Result: no spinner per keystroke, real filters, stable counts.
 *
 * The ledger is the primary surface: one row per finding, monospace location,
 * and arrow-key navigation. Selecting a row is immediate — no navigation, no
 * drawer animation — because triage is a scanning activity.
 */

const CATEGORY_LABELS: Record<string, string> = {
  security: 'Security',
  logic: 'Logic',
  api_misuse: 'API misuse',
  database: 'Database',
  dependency: 'Dependency',
  reliability: 'Reliability',
};

const STATUS_ORDER = ['verified', 'probable', 'rejected'] as const;

type SortKey = 'severity' | 'newest' | 'file';
type GroupKey = 'none' | 'severity' | 'repository';

export function FindingsExplorer() {
  const { data: reposRaw } = useRepositories();
  const { data: scansRaw } = useScans();

  const repos = useMemo<Repository[]>(() => (Array.isArray(reposRaw) ? reposRaw : []), [reposRaw]);
  const scans = useMemo<Scan[]>(() => (Array.isArray(scansRaw) ? scansRaw : []), [scansRaw]);

  const [severity, setSeverity] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('severity');
  const [group, setGroup] = useState<GroupKey>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [facetsOpen, setFacetsOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  // The counts window: unfiltered, so the rail keeps showing the whole corpus.
  const universeQuery = useFindings({ limit: 300 });

  // The view: filtered on the server through the real query contract.
  const viewParams = useMemo(() => {
    const params: {
      limit: number;
      severity?: string;
      status?: string;
      category?: string;
      repository_id?: string;
    } = { limit: 300 };
    if (severity) params.severity = severity;
    if (status) params.status = status;
    if (category) params.category = category;
    if (repoId) params.repository_id = repoId;
    return params;
  }, [severity, status, category, repoId]);

  const viewQuery = useFindings(viewParams);

  const universe = useMemo<Finding[]>(
    () => (Array.isArray(universeQuery.data) ? universeQuery.data : []),
    [universeQuery.data]
  );
  const view = useMemo<Finding[]>(
    () => (Array.isArray(viewQuery.data) ? viewQuery.data : []),
    [viewQuery.data]
  );

  const repoName = useMemo(() => new Map(repos.map((r) => [r.id, r.name])), [repos]);
  const scanRepo = useMemo(() => new Map(scans.map((s) => [s.id, s.repository_id])), [scans]);
  const repoFor = useCallback(
    (finding: Finding): string => {
      const id = scanRepo.get(finding.scan_id);
      return (id && repoName.get(id)) || '—';
    },
    [repoName, scanRepo]
  );

  const counts = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byRepo: Record<string, number> = {};
    for (const finding of universe) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
      byStatus[finding.status] = (byStatus[finding.status] ?? 0) + 1;
      byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
      const repo = repoFor(finding);
      byRepo[repo] = (byRepo[repo] ?? 0) + 1;
    }
    return { bySeverity, byStatus, byCategory, byRepo };
  }, [universe, repoFor]);

  /** Text search runs over the filtered window — instant, no request per key. */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? view.filter(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            f.file_path.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q) ||
            (f.function_name ?? '').toLowerCase().includes(q)
        )
      : view;

    const sorted = [...filtered];
    if (sort === 'severity') {
      sorted.sort((a, b) => {
        const bySeverity = SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
        if (bySeverity !== 0) return bySeverity;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else if (sort === 'newest') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      sorted.sort(
        (a, b) =>
          a.file_path.localeCompare(b.file_path) || (a.line_start ?? 0) - (b.line_start ?? 0)
      );
    }
    return sorted;
  }, [view, query, sort]);

  const selected = rows.find((f) => f.id === selectedId) ?? rows[0] ?? null;

  const grouped = useMemo(() => {
    if (group === 'none') return [{ key: '', rows }];
    const map = new Map<string, Finding[]>();
    for (const finding of rows) {
      const key = group === 'severity' ? finding.severity : repoFor(finding);
      const bucket = map.get(key);
      if (bucket) bucket.push(finding);
      else map.set(key, [finding]);
    }
    const entries = [...map.entries()];
    if (group === 'severity') {
      entries.sort(
        (a, b) => SEVERITIES.indexOf(a[0] as never) - SEVERITIES.indexOf(b[0] as never)
      );
    } else {
      entries.sort((a, b) => b[1].length - a[1].length);
    }
    return entries.map(([key, value]) => ({ key, rows: value }));
  }, [group, rows, repoFor]);

  // Keyboard navigation over the flat row order.
  const flatRows = useMemo(() => grouped.flatMap((g) => g.rows), [grouped]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (flatRows.length === 0) return;
      const index = flatRows.findIndex((f) => f.id === selected?.id);
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        setSelectedId(flatRows[Math.min(flatRows.length - 1, index + 1)]?.id ?? null);
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        setSelectedId(flatRows[Math.max(0, index - 1)]?.id ?? null);
      }
    },
    [flatRows, selected?.id]
  );

  const activeFilters = [severity, status, category, repoId].filter(Boolean).length;
  const clearAll = () => {
    setSeverity(null);
    setStatus(null);
    setCategory(null);
    setRepoId(null);
    setQuery('');
  };

  const loading = universeQuery.isLoading || viewQuery.isLoading;

  return (
    <div className="space-y-5">
      {/* -------------------------------------------------------- header */}
      <div>
        <Rule
          label="Findings"
          right={
            <div className="flex items-center gap-2">
              <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {rows.length} shown
                {activeFilters > 0 ? ` · ${activeFilters} filter${activeFilters > 1 ? 's' : ''}` : ''}
              </span>
              <button
                onClick={() => setFacetsOpen((v) => !v)}
                aria-expanded={facetsOpen}
                className="rvx-mono inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground lg:hidden"
              >
                <Filter className="h-3 w-3" aria-hidden="true" />
                filters
              </button>
            </div>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative flex min-w-[200px] flex-1 items-center">
            <Search
              className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">Search findings</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by title, file, function or description…"
              className="h-9 w-full rounded-[var(--radius-md)] border bg-transparent pl-8 pr-8 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[hsl(var(--rvx-source))] rvx-hairline"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <label className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border px-2 text-[11px] rvx-hairline">
            <ArrowDownUp className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Sort findings</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rvx-mono bg-transparent text-[11px] uppercase tracking-wider outline-none"
            >
              <option value="severity">severity</option>
              <option value="newest">newest</option>
              <option value="file">file</option>
            </select>
          </label>

          <label className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border px-2 text-[11px] rvx-hairline">
            <SlidersHorizontal className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Group findings</span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as GroupKey)}
              className="rvx-mono bg-transparent text-[11px] uppercase tracking-wider outline-none"
            >
              <option value="none">no grouping</option>
              <option value="severity">by severity</option>
              <option value="repository">by repository</option>
            </select>
          </label>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearAll}>
              <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[196px_minmax(0,1fr)] xl:grid-cols-[196px_minmax(0,1fr)_340px]">
        {/* ---------------------------------------------------- facet rail */}
        <aside
          className={cn(
            'min-w-0 lg:sticky lg:top-[104px] lg:self-start',
            facetsOpen ? 'block' : 'hidden lg:block'
          )}
        >
          <div className="space-y-5">
            <FacetGroup
              label="Severity"
              active={severity}
              onSelect={setSeverity}
              options={SEVERITIES.map((key) => ({
                key,
                label: key,
                count: counts.bySeverity[key] ?? 0,
              }))}
            />
            <FacetGroup
              label="Verdict"
              active={status}
              onSelect={setStatus}
              options={STATUS_ORDER.map((key) => ({
                key,
                label: key,
                count: counts.byStatus[key] ?? 0,
              }))}
            />
            <FacetGroup
              label="Category"
              active={category}
              onSelect={setCategory}
              options={Object.keys(counts.byCategory)
                .sort()
                .map((key) => ({
                  key,
                  label: CATEGORY_LABELS[key] ?? key,
                  count: counts.byCategory[key] ?? 0,
                }))}
            />
            {repos.length > 0 && (
              <FacetGroup
                label="Repository"
                active={repoId ? (repoName.get(repoId) ?? repoId) : null}
                onSelect={(value) => {
                  if (value === null) return setRepoId(null);
                  const found = repos.find((r) => r.name === value);
                  setRepoId(found?.id ?? null);
                }}
                options={repos
                  .map((repo) => ({
                    key: repo.name,
                    label: repo.name,
                    count: counts.byRepo[repo.name] ?? 0,
                  }))
                  .sort((a, b) => b.count - a.count)}
              />
            )}
          </div>
        </aside>

        {/* ------------------------------------------------------- ledger */}
        <div className="min-w-0">
          {loading ? (
            <ConsoleSkeleton rows={8} />
          ) : rows.length === 0 ? (
            <ConsoleEmpty
              title={activeFilters > 0 || query ? 'No findings match this slice' : 'No findings yet'}
              body={
                activeFilters > 0 || query
                  ? 'Nothing in the corpus matches the filters and search text. Widen the slice to see what else is there.'
                  : 'Analysis has not produced any findings for this workspace. Run an analysis to populate the ledger.'
              }
              action={
                activeFilters > 0 || query ? (
                  <Button size="sm" variant="outline" onClick={clearAll}>
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href="/scans/new">Analyze a repository</Link>
                  </Button>
                )
              }
            />
          ) : (
            <div
              ref={listRef}
              tabIndex={0}
              onKeyDown={onKeyDown}
              className="overflow-hidden rounded-[var(--radius-md)] border outline-none rvx-hairline focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              aria-label="Findings ledger. Use arrow keys to move between findings."
            >
              <div
                className="rvx-row rvx-eyebrow bg-[hsl(var(--rvx-surface-2)/0.5)]"
                style={{ gridTemplateColumns: '18px minmax(0,1fr) auto auto' }}
              >
                <span aria-hidden="true" />
                <span>Finding</span>
                <span className="hidden md:block">Repository</span>
                <span className="text-right">Age</span>
              </div>

              {grouped.map((bucket) => (
                <div key={bucket.key || 'all'}>
                  {bucket.key && (
                    <div className="rvx-row bg-[hsl(var(--rvx-inset))]" style={{ gridTemplateColumns: '1fr auto' }}>
                      <span className="rvx-eyebrow text-foreground/80">
                        {group === 'severity' ? bucket.key : bucket.key}
                      </span>
                      <span className="rvx-mono text-[10px] text-muted-foreground">
                        {bucket.rows.length}
                      </span>
                    </div>
                  )}
                  {bucket.rows.map((finding) => {
                    const isSelected = selected?.id === finding.id;
                    return (
                      <button
                        key={finding.id}
                        type="button"
                        onClick={() => setSelectedId(finding.id)}
                        data-selected={isSelected}
                        aria-current={isSelected ? 'true' : undefined}
                        className="rvx-row w-full text-left"
                        style={{ gridTemplateColumns: '18px minmax(0,1fr) auto auto' }}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: `hsl(var(--sev-${finding.severity}))` }}
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="truncate text-[13px] font-medium">{finding.title}</span>
                            <SeverityBadge severity={finding.severity} />
                            <VerdictBadge status={finding.status} />
                          </span>
                          <span className="rvx-mono mt-0.5 block truncate text-[10px] text-muted-foreground">
                            {finding.file_path}
                            {finding.line_start ? `:${finding.line_start}` : ''}
                            {finding.function_name ? ` · ${finding.function_name}()` : ''}
                            {' · '}
                            {CATEGORY_LABELS[finding.category] ?? finding.category}
                          </span>
                        </span>
                        <span className="rvx-mono hidden truncate text-[10px] text-muted-foreground md:block">
                          {repoFor(finding)}
                        </span>
                        <span className="rvx-mono text-right text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(finding.created_at), { addSuffix: false })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            ↑ ↓ move the selection · facets are applied by the API · search filters the loaded
            window of up to 300 records.
          </p>
        </div>

        {/* ------------------------------------------------------ preview */}
        {selected && (
          <aside className="min-w-0 xl:sticky xl:top-[104px] xl:self-start">
            <FindingPreview finding={selected} repository={repoFor(selected)} />
          </aside>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- facet rail */

function FacetGroup({
  label,
  active,
  onSelect,
  options,
}: {
  label: string;
  active: string | null;
  onSelect: (value: string | null) => void;
  options: { key: string; label: string; count: number }[];
}) {
  const visible = options.filter((option) => option.count > 0 || option.key === active);
  if (visible.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 border-b pb-1.5 rvx-hairline">
        <span className="rvx-eyebrow">{label}</span>
        {active && (
          <button
            onClick={() => onSelect(null)}
            className="rvx-mono ml-auto text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            reset
          </button>
        )}
      </div>
      <div className="mt-1.5 space-y-px">
        {visible.map((option) => {
          const isActive = option.key === active;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelect(isActive ? null : option.key)}
              aria-pressed={isActive}
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 text-left text-[12px] transition-colors',
                isActive
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <span className="min-w-0 flex-1 truncate capitalize">{option.label}</span>
              <span className="rvx-mono shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ preview */

function FindingPreview({ finding, repository }: { finding: Finding; repository: string }) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b p-3 rvx-hairline">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} variant="solid" />
          <VerdictBadge status={finding.status} />
          <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {finding.category.replace('_', ' ')}
          </span>
        </div>
        <h2 className="rvx-title mt-2.5 text-[15px] leading-snug">{finding.title}</h2>
        <p className="rvx-mono mt-1.5 break-all text-[10px] text-muted-foreground">
          {finding.file_path}
          {finding.line_start ? `:${finding.line_start}` : ''}
        </p>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StageTag stage="source" />
          <span aria-hidden="true" className="rvx-mono text-[10px] text-muted-foreground">
            →
          </span>
          <StageTag stage="sink" />
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <dt className="rvx-eyebrow">Repository</dt>
            <dd className="rvx-mono mt-0.5 truncate text-[11px]">{repository}</dd>
          </div>
          <div>
            <dt className="rvx-eyebrow">Source</dt>
            <dd className="rvx-mono mt-0.5 text-[11px]">{finding.source}</dd>
          </div>
          <div>
            <dt className="rvx-eyebrow">Function</dt>
            <dd className="rvx-mono mt-0.5 truncate text-[11px]">
              {finding.function_name ? `${finding.function_name}()` : '—'}
            </dd>
          </div>
          <div>
            <dt className="rvx-eyebrow">Discovered</dt>
            <dd className="rvx-mono mt-0.5 text-[11px]">
              {formatDistanceToNow(new Date(finding.created_at), { addSuffix: true })}
            </dd>
          </div>
        </dl>

        <div>
          <p className="rvx-eyebrow">Why it matters</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {finding.impact || finding.description}
          </p>
        </div>

        {finding.recommendation && (
          <div>
            <p className="rvx-eyebrow">Documented fix</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {finding.recommendation}
            </p>
          </div>
        )}

        <Button asChild size="sm" className="w-full">
          <Link href={`/findings/${finding.id}`}>
            Open the investigation
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Panel>
  );
}
