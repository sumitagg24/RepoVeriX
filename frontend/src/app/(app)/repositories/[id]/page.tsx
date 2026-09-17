'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRepository } from '@/hooks/useRepositories';
import { useScans } from '@/hooks/useScans';
import { GitBranch, ExternalLink, Plus, Search, Loader2, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Breadcrumbs, PageHeader } from '@/components/system/page-header';
import { ScanStatus } from '@/components/system/status';
import { EmptyState, ListSkeleton } from '@/components/ui/state';

export default function RepositoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: repository, isLoading: repoLoading } = useRepository(id);
  const { data: scans, isLoading: scansLoading } = useScans(id);

  if (repoLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="h-20 bg-muted animate-pulse rounded" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Repositories', href: '/repositories' }, { label: 'Not found' }]} />
        <Card>
          <EmptyState
            icon={GitBranch}
            title="Repository not found"
            body="It may have been deleted, or the link is stale."
            ctaHref="/repositories"
            ctaLabel="Back to repositories"
          />
        </Card>
      </div>
    );
  }

  const recentScans = scans?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Repositories', href: '/repositories' }, { label: repository.name }]} />
      <PageHeader
        eyebrow={`${repository.source_type} · ${repository.default_branch} · ${repository.status}`}
        title={repository.name}
        meta={
          repository.primary_languages?.length ? (
            <span className="text-xs text-muted-foreground">
              {repository.primary_languages.slice(0, 3).join(' · ')}
            </span>
          ) : undefined
        }
        actions={
          <>
            {repository.source_url && (
              <a href={repository.source_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View source
                </Button>
              </a>
            )}
            <Button asChild className="gap-2 shadow-sm">
              <Link href={`/scans/new?repo=${repository.id}`}>
                <Plus className="h-4 w-4" />
                New scan
              </Link>
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scans?.length || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {scans?.filter(s => s.status === 'completed').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {scans?.filter(s => s.status === 'running').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {scans?.filter(s => s.status === 'failed').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scans">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scans">Scans ({scans?.length || 0})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="scans">
          <Card>
            <CardContent className="p-0">
              {scansLoading ? (
                <ListSkeleton rows={3} />
              ) : recentScans.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No scans yet"
                  body="Start the first scan to analyze this repository with the full evidence pipeline."
                  action={
                    <Button asChild>
                      <Link href={`/scans/new?repo=${repository.id}`}>Start scan</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border/60">
                  {recentScans.map((scan) => (
                    <Link
                      key={scan.id}
                      href={`/scans/${scan.id}`}
                      className="data-row flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium capitalize">{scan.configuration.replace('_', ' ')}</span>
                          <ScanStatus status={scan.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                          {scan.started_at && ` · started ${formatDistanceToNow(new Date(scan.started_at), { addSuffix: true })}`}
                          {scan.finished_at && ` · finished ${formatDistanceToNow(new Date(scan.finished_at), { addSuffix: true })}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{scan.finished_at ? formatDistanceToNow(new Date(scan.finished_at), { addSuffix: true }) : 'In progress'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Repository Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">ID</dt>
                  <dd className="font-mono text-sm break-all">{repository.id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Owner ID</dt>
                  <dd className="font-mono text-sm break-all">{repository.owner_id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Source Type</dt>
                  <dd className="capitalize">{repository.source_type}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Source URL</dt>
                  <dd className="truncate max-w-xs">
                    {repository.source_url ? (
                      <a href={repository.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {repository.source_url}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Default Branch</dt>
                  <dd>{repository.default_branch}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Storage Path</dt>
                  <dd className="font-mono text-sm break-all">{repository.storage_path || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Primary Languages</dt>
                  <dd>
                    {repository.primary_languages.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {repository.primary_languages.map((lang) => (
                          <Badge key={lang} variant="secondary">{lang}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not detected</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd><Badge variant="outline" className="capitalize">{repository.status}</Badge></dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd>{new Date(repository.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Updated</dt>
                  <dd>{new Date(repository.updated_at).toLocaleString()}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}