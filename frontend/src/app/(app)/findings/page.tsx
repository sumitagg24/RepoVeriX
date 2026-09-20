'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileSearch, RefreshCw } from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FindingTable, SeverityTally } from '@/components/findings/finding-table';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, SkeletonTable } from '@/components/ui/states';
import {
  FilterChips,
  Pagination,
  ResultCount,
  SearchInput,
  SelectFilter,
  Toolbar,
  usePagination,
} from '@/components/ui/toolbar';
import { useFindings } from '@/hooks/use-findings';
import { useRepositories } from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';
import {
  CATEGORY_LABEL,
  FINDING_CATEGORIES,
  FINDING_STATUS_LABEL,
  FINDING_STATUS_TONE,
  SEVERITY_RANK,
} from '@/lib/domain';
import type { Finding } from '@/types/api';

/**
 * Findings.
 *
 * The dense surface of the product. Filters map to real API parameters where the
 * endpoint supports them (severity, status, category, scan, repository) and to
 * client-side matching where it does not (free-text search and sorting), so
 * nothing here requires a backend change.
 *
 * Query parameters are read on arrival, which is what makes links from the
 * dashboard, a scan page or a repository page land on a pre-filtered list.
 */
export default function FindingsPage() {
  return (
    <React.Suspense fallback={null}>
      <FindingsView />
    </React.Suspense>
  );
}

function FindingsView() {
  const params = useSearchParams();
  const initialSeverity = params.get('severity') ?? 'all';
  const scanId = params.get('scan') ?? undefined;
  const repositoryId = params.get('repository') ?? 'all';
  const statusParam = params.get('status') ?? 'all';
  const categoryParam = params.get('category') ?? 'all';
  const queryParam = params.get('q') ?? '';

  const [search, setSearch] = React.useState(queryParam);
  const [sort, setSort] = React.useState('severity');
  const [severity, setSeverity] = React.useState(initialSeverity);
  const [status, setStatus] = React.useState(statusParam);
  const [category, setCategory] = React.useState(categoryParam);

  const findings = useFindings({
    severity: severity === 'all' ? undefined : severity,
    status: status === 'all' ? undefined : status,
    category: category === 'all' ? undefined : category,
    scan_id: scanId,
    repository_id: repositoryId === 'all' ? undefined : repositoryId,
    limit: 200,
  });
  const repositories = useRepositories();
  const scans = useScans(repositoryId === 'all' ? undefined : repositoryId);

  const repositoryIdByScan = React.useMemo(() => {
    const map = new Map<string, string>();
    (scans.data ?? []).forEach((scan) => map.set(scan.id, scan.repository_id));
    return map;
  }, [scans.data]);

  const repositoryNames = React.useMemo(() => {
    const map = new Map<string, string>();
    (repositories.data ?? []).forEach((repository) => map.set(repository.id, repository.name));
    return map;
  }, [repositories.data]);

  const repositoryFor = React.useCallback(
    (finding: Finding) => {
      const id = repositoryIdByScan.get(finding.scan_id);
      return id ? repositoryNames.get(id) : undefined;
    },
    [repositoryIdByScan, repositoryNames],
  );

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = [...(findings.data ?? [])];
    const filtered = term
      ? list.filter(
          (finding) =>
            finding.title.toLowerCase().includes(term) ||
            finding.external_id.toLowerCase().includes(term) ||
            finding.file_path.toLowerCase().includes(term) ||
            (finding.function_name ?? '').toLowerCase().includes(term),
        )
      : list;

    filtered.sort((a, b) => {
      if (sort === 'recent') return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === 'confidence') return b.confidence - a.confidence;
      if (sort === 'path') return a.file_path.localeCompare(b.file_path);
      return (
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        +new Date(b.created_at) - +new Date(a.created_at)
      );
    });
    return filtered;
  }, [findings.data, search, sort]);

  const { page, pageCount, slice, setPage } = usePagination(rows, 25);

  const severityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    (findings.data ?? []).forEach((finding) => {
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    });
    return counts;
  }, [findings.data]);

  const filtered = severity !== 'all' || status !== 'all' || category !== 'all' || Boolean(search);

  return (
    <AppPage>
      <PageHeader
        title="Findings"
        description="Every claim the engine made, with the file it points at and the verdict validation recorded. A rejected finding stays in the list."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void findings.refetch()}
            loading={findings.isFetching}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Refresh
          </Button>
        }
        meta={
          findings.data ? (
            <SeverityTally bySeverity={severityCounts} className="w-full" />
          ) : undefined
        }
      />

      {findings.isError ? (
        <ErrorState
          title="Could not load findings"
          body="The findings endpoint did not answer with these filters. Widen the filters and try again."
          onRetry={() => void findings.refetch()}
        />
      ) : null}

      {findings.isLoading ? <SkeletonTable rows={8} columns={6} /> : null}

      {!findings.isLoading && !findings.isError && rows.length > 0 ? (
        <>
          <Toolbar>
            <SearchInput
              label="Search findings"
              value={search}
              onChange={setSearch}
              placeholder="Search title, rule id, path or function"
            />
            <FilterChips
              label="Severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: 'all', label: 'All' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
                { value: 'info', label: 'Info' },
              ]}
            />
            <SelectFilter
              label="Verdict"
              value={status}
              onChange={setStatus}
              anyLabel="Any verdict"
              options={Object.entries(FINDING_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <SelectFilter
              label="Category"
              value={category}
              onChange={setCategory}
              anyLabel="All categories"
              options={FINDING_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] }))}
            />
            <SelectFilter
              label="Sort"
              value={sort}
              onChange={setSort}
              anyLabel={null}
              options={[
                { value: 'severity', label: 'Severity, then newest' },
                { value: 'recent', label: 'Newest first' },
                { value: 'confidence', label: 'Highest confidence' },
                { value: 'path', label: 'File path' },
              ]}
            />
          </Toolbar>

          <p className="text-[12.5px] text-muted">
            {Object.entries(FINDING_STATUS_TONE)
              .map(([name]) => `${FINDING_STATUS_LABEL[name as keyof typeof FINDING_STATUS_LABEL]}`)
              .join(', ')}{' '}
            are the recorded verdicts. Confidence is the analyzer’s own number and says nothing about
            whether the finding was reproduced.
          </p>

          <div className="space-y-3">
            <ResultCount shown={slice.length} total={rows.length} label="findings" />

            {slice.length === 0 ? (
              <EmptyState
                title="No finding matches those filters"
                body="The claims are still there, just outside this filter set."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setSeverity('all');
                      setStatus('all');
                      setCategory('all');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <FindingTable findings={slice} repositoryFor={repositoryFor} />
            )}

            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </>
      ) : null}

      {!findings.isLoading && !findings.isError && rows.length === 0 ? (
        <EmptyState
          icon={<FileSearch className="size-4" aria-hidden="true" />}
          title={filtered ? 'No finding matches those filters' : 'No findings recorded yet'}
          body={
            filtered
              ? 'Try widening the severity, verdict or category filters.'
              : 'Findings appear when a scan completes. Static-only scans produce detector findings immediately; the RepoVeriX configuration adds model reasoning and evidence validation.'
          }
          action={
            filtered ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setSeverity('all');
                  setStatus('all');
                  setCategory('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild size="sm" variant="primary">
                <Link href="/scans/new">Start a scan</Link>
              </Button>
            )
          }
        />
      ) : null}
    </AppPage>
  );
}
