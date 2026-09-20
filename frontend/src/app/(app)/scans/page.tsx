'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ScanTable } from '@/components/scans/scan-table';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/panel';
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
import { useRepositories } from '@/hooks/use-repositories';
import { useCancelScan, useScans } from '@/hooks/use-scans';
import { SCAN_CONFIGURATIONS, SCAN_STATUS_LABEL } from '@/lib/domain';
import { relativeTime } from '@/lib/dates';

/**
 * Scans.
 *
 * A scan list has three jobs: show what is running now, show what finished and
 * what came out of it, and make a stuck scan stoppable. Status filters are
 * chips because they are the thing people toggle most, and the repository filter
 * is a real select because the list can be long.
 */
export default function ScansPage() {
  const scans = useScans();
  const repositories = useRepositories();
  const cancelScan = useCancelScan();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [configuration, setConfiguration] = React.useState('all');

  const repositoryNames = React.useMemo(() => {
    const map = new Map<string, string>();
    (repositories.data ?? []).forEach((repository) => map.set(repository.id, repository.name));
    return map;
  }, [repositories.data]);

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = [...(scans.data ?? [])];
    if (status !== 'all') list = list.filter((scan) => scan.status === status);
    if (configuration !== 'all') list = list.filter((scan) => scan.configuration === configuration);
    if (term) {
      list = list.filter((scan) => {
        const repository = repositoryNames.get(scan.repository_id) ?? '';
        return (
          repository.toLowerCase().includes(term) ||
          scan.configuration.toLowerCase().includes(term) ||
          scan.id.toLowerCase().includes(term)
        );
      });
    }
    return list;
  }, [scans.data, status, configuration, search, repositoryNames]);

  const { page, pageCount, slice, setPage } = usePagination(rows, 10);
  const running = (scans.data ?? []).filter(
    (scan) => scan.status === 'running' || scan.status === 'pending',
  );

  const onCancel = async (id: string) => {
    try {
      await cancelScan.mutateAsync(id);
      toast.success('Scan cancelled');
    } catch {
      toast.error('The scan could not be cancelled. It may have already finished.');
    }
  };

  return (
    <AppPage>
      <PageHeader
        title="Scans"
        description="Every run, its configuration and its outcome. A scan reads a stored snapshot, so it never touches a working copy."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void scans.refetch()}
              loading={scans.isFetching}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link href="/scans/new">
                <ScanSearch className="size-3.5" aria-hidden="true" />
                New scan
              </Link>
            </Button>
          </>
        }
      />

      {scans.isError ? (
        <ErrorState
          title="Could not load scans"
          body="The scans endpoint did not answer. Anything already running continues on the worker."
          onRetry={() => void scans.refetch()}
        />
      ) : null}

      {running.length > 0 ? (
        <Callout tone="accent" title={`${running.length} scan${running.length === 1 ? '' : 's'} in flight`}>
          Queued and running scans are polled every few seconds, so this page updates on its own.
          The slowest part is usually dependency resolution on a large repository.
        </Callout>
      ) : null}

      {scans.isLoading ? <SkeletonTable rows={6} columns={7} /> : null}

      {!scans.isLoading && !scans.isError && (scans.data ?? []).length === 0 ? (
        <EmptyState
          icon={<ScanSearch className="size-4" aria-hidden="true" />}
          title="No scans yet"
          body="Pick a repository and a configuration. Static only needs no model provider, and it is the fastest way to see what the detectors find."
          action={
            <Button asChild size="sm" variant="primary">
              <Link href="/scans/new">Start a scan</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild size="sm" variant="secondary">
              <Link href="/repositories">Check repositories</Link>
            </Button>
          }
        />
      ) : null}

      {!scans.isLoading && (scans.data ?? []).length > 0 ? (
        <>
          <Toolbar>
            <SearchInput
              label="Search scans"
              value={search}
              onChange={setSearch}
              placeholder="Search by repository, configuration or id"
            />
            <FilterChips
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All' },
                { value: 'running', label: SCAN_STATUS_LABEL.running },
                { value: 'pending', label: SCAN_STATUS_LABEL.pending },
                { value: 'completed', label: SCAN_STATUS_LABEL.completed },
                { value: 'failed', label: SCAN_STATUS_LABEL.failed },
              ]}
            />
            <SelectFilter
              label="Configuration"
              value={configuration}
              onChange={setConfiguration}
              anyLabel="All configurations"
              options={SCAN_CONFIGURATIONS.map((item) => ({ value: item.value, label: item.label }))}
            />
          </Toolbar>

          <div className="space-y-3">
            <ResultCount
              shown={slice.length}
              total={rows.length}
              label="scans"
            />
            {slice.length === 0 ? (
              <EmptyState
                title="No scan matches those filters"
                body="Clear the filters to see every run in this workspace."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setStatus('all');
                      setConfiguration('all');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <ScanTable
                scans={slice}
                repositoryName={(id) => repositoryNames.get(id)}
                onCancel={(id) => void onCancel(id)}
                cancelPendingId={cancelScan.isPending ? (cancelScan.variables as string) : null}
              />
            )}
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
            <p className="text-[12.5px] text-faint">
              Latest run {rows[0] ? relativeTime(rows[0].created_at) : 'None'}.
            </p>
          </div>
        </>
      ) : null}
    </AppPage>
  );
}
