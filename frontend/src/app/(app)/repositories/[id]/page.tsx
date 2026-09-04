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
import { cn } from '@/lib/utils';

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
      <div className="text-center py-12">
        <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-medium mb-2">Repository not found</h3>
        <Link href="/repositories">
          <Button variant="outline" className="mt-4">Back to Repositories</Button>
        </Link>
      </div>
    );
  }

  const recentScans = scans?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/repositories" className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
            ← Back to Repositories
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <GitBranch className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{repository.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                <Badge variant="outline" className="capitalize">{repository.source_type}</Badge>
                <Badge variant="outline">{repository.default_branch}</Badge>
                <Badge variant="outline" className={cn(
                  repository.status === 'active' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                  repository.status === 'registered' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  repository.status === 'archived' && 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                )}>
                  {repository.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {repository.source_url && (
            <a href={repository.source_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          )}
          <Button asChild>
            <Link href={`/scans/new?repo=${repository.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              New Scan
            </Link>
          </Button>
        </div>
      </div>

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scans">Scans ({scans?.length || 0})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="scans">
          <Card>
            <CardContent className="p-0">
              {scansLoading ? (
                <div className="space-y-4 p-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentScans.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No scans yet</h3>
                  <p className="text-muted-foreground mb-4">Start your first scan to analyze this repository</p>
                  <Button asChild>
                    <Link href={`/scans/new?repo=${repository.id}`}>Start Scan</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {recentScans.map((scan) => (
                    <Link
                      key={scan.id}
                      href={`/scans/${scan.id}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-3 rounded-lg flex-shrink-0 ${[
                          'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                          'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                          'bg-green-500/10 text-green-600 dark:text-green-400',
                          'bg-red-500/10 text-red-600 dark:text-red-400',
                        ][['pending', 'running', 'completed', 'failed'].indexOf(scan.status)] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400'}`}>
                          <Search className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="font-medium capitalize">{scan.configuration.replace('_', ' ')}</span>
                            <Badge variant="outline" className={cn(
                              scan.status === 'pending' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                              scan.status === 'running' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse',
                              scan.status === 'completed' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                              scan.status === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400'
                            )}>
                              {scan.status === 'running' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span>{formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}</span>
                            {scan.started_at && <span>Started {formatDistanceToNow(new Date(scan.started_at), { addSuffix: true })}</span>}
                            {scan.finished_at && <span>Finished {formatDistanceToNow(new Date(scan.finished_at), { addSuffix: true })}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
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