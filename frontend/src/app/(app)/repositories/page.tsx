'use client';

import * as React from 'react';
import Link from 'next/link';
import { Database, Plus, RefreshCw } from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Callout, Panel } from '@/components/ui/panel';
import { EmptyState, ErrorState, LoadingRegion, SkeletonTable } from '@/components/ui/states';
import { Pagination, ResultCount, SearchInput, SelectFilter, Toolbar, usePagination } from '@/components/ui/toolbar';
import { RepositoryTable } from '@/components/repositories/repository-table';
import { useRepositories } from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';
import { SOURCE_TYPE_LABEL } from '@/lib/domain';
import { useOAuthConnections } from '@/hooks/use-platform';
import type { Scan } from '@/types/api';

/**
 * Repositories.
 *
 * The list is small enough to filter in the browser, and doing it here means the
 * filters are instant and the endpoint stays exactly as it is. Pagination is
 * local for the same reason: the API returns the whole set for an account.
 */
export default function RepositoriesPage() {
  const repositories = useRepositories();
  const scans = useScans();
  const connections = useOAuthConnections();
  const [search, setSearch] = React.useState('');
  const [provider, setProvider] = React.useState('all');
  const [sort, setSort] = React.useState('recent');

  const latestScan = React.useMemo(() => {
    const map = new Map<string, Scan>();
    (scans.data ?? []).forEach((scan) => {
      const existing = map.get(scan.repository_id);
      if (!existing || new Date(scan.created_at) > new Date(existing.created_at)) {
        map.set(scan.repository_id, scan);
      }
    });
    return map;
  }, [scans.data]);

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = [...(repositories.data ?? [])];
    if (provider !== 'all') list = list.filter((repository) => repository.source_type === provider);
    if (term) {
      list = list.filter(
        (repository) =>
          repository.name.toLowerCase().includes(term) ||
          (repository.source_url ?? '').toLowerCase().includes(term),
      );
    }
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
    return list;
  }, [repositories.data, provider, search, sort]);

  const { page, pageCount, slice, setPage } = usePagination(rows, 10);

  const providerOptions = React.useMemo(() => {
    const present = new Set((repositories.data ?? []).map((repository) => repository.source_type));
    return Array.from(present).map((value) => ({
      value,
      label: SOURCE_TYPE_LABEL[value] ?? value,
    }));
  }, [repositories.data]);

  const connectionsLoaded = !connections.isLoading;
  const hasConnection = (connections.data ?? []).length > 0;

  return (
    <AppPage>
      <PageHeader
        title="Repositories"
        description="Every repository this workspace can scan, with its import state, its last scan and how much is sitting in it."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void repositories.refetch()}
              loading={repositories.isFetching}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link href="/repositories/new">
                <Plus className="size-3.5" aria-hidden="true" />
                Import repository
              </Link>
            </Button>
          </>
        }
      />

      {repositories.isError ? (
        <ErrorState
          title="Could not load repositories"
          body="The repositories endpoint did not answer. Nothing has been lost; the list is simply unavailable right now."
          detail={repositories.error instanceof Error ? repositories.error.message : undefined}
          onRetry={() => void repositories.refetch()}
        />
      ) : null}

      {repositories.isLoading ? <SkeletonTable rows={5} columns={6} /> : null}

      {!repositories.isLoading && !repositories.isError && (repositories.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Database className="size-4" aria-hidden="true" />}
          title="No repositories connected yet"
          body="Import from GitHub or GitLab if a provider is configured on this deployment, or point at a Git URL, an archive link, or upload a ZIP."
          action={
            <Button asChild size="sm" variant="primary">
              <Link href="/repositories/new">Import a repository</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings/integrations">Check integrations</Link>
            </Button>
          }
          steps={[
            { label: 'Connect a source control provider', done: hasConnection },
            { label: 'Import the repository' },
            { label: 'Run the first scan' },
          ]}
        />
      ) : null}

      {!repositories.isLoading && (repositories.data ?? []).length > 0 ? (
        <>
          {connectionsLoaded && !hasConnection ? (
            <Callout
              tone="info"
              title="No source control provider is connected"
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href="/settings/integrations">Connect a provider</Link>
                </Button>
              }
            >
              GitHub and GitLab imports need an OAuth app configured on this deployment. Git URLs,
              archive URLs and ZIP uploads work without one.
            </Callout>
          ) : null}

          <Toolbar>
            <SearchInput
              label="Search repositories"
              value={search}
              onChange={setSearch}
              placeholder="Search by name or source URL"
            />
            <SelectFilter
              label="Provider"
              value={provider}
              onChange={setProvider}
              options={providerOptions}
              anyLabel="All providers"
            />
            <SelectFilter
              label="Sort"
              value={sort}
              onChange={setSort}
              anyLabel={null}
              options={[
                { value: 'recent', label: 'Most recent' },
                { value: 'name', label: 'Name' },
                { value: 'oldest', label: 'Oldest first' },
              ]}
            />
          </Toolbar>

          <div className="space-y-3">
            <ResultCount shown={slice.length} total={rows.length} label="repositories" />

            {slice.length === 0 ? (
              <Panel className="px-5 py-8 text-center">
                <p className="text-[13.5px] text-body">
                  No repository matches those filters.
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setProvider('all');
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              </Panel>
            ) : (
              <RepositoryTable
                repositories={slice}
                latestScanFor={(id) => latestScan.get(id)}
              />
            )}

            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </>
      ) : null}
    </AppPage>
  );
}
