'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardSummary } from '@/hooks/useDashboard';
import { useRepositories } from '@/hooks/useRepositories';
import { useScans } from '@/hooks/useScans';
import { useFindings } from '@/hooks/useFindings';
import {
  GitBranch,
  Search,
  Bug,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Settings,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

const scanStatusColors: Record<string, string> = {
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashboardLoading } = useDashboardSummary();
  const { data: repositories, isLoading: reposLoading } = useRepositories();
  const { data: scans, isLoading: scansLoading } = useScans();
  const { data: findings, isLoading: findingsLoading } = useFindings({ limit: 5 });

  const isLoading = dashboardLoading || reposLoading || scansLoading || findingsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const recentScans = scans?.slice(0, 5) || [];
  const recentFindings = findings?.slice(0, 5) || [];
  const recentRepos = repositories?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Repositories
            </CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.total_repositories || 0}</div>
            <p className="text-xs text-muted-foreground">Total repositories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scans
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.total_scans || 0}</div>
            <p className="text-xs text-muted-foreground">Total scans performed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Findings
            </CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.findings.total || 0}</div>
            <p className="text-xs text-muted-foreground">Total issues found</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {dashboard?.findings.by_severity.critical || 0}
            </div>
            <p className="text-xs text-muted-foreground">Critical severity issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Scans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Scans</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/scans">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentScans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scans yet</p>
                <Button className="mt-4" asChild>
                  <Link href="/scans/new">Create your first scan</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentScans.map((scan) => (
                  <Link
                    key={scan.id}
                    href={`/scans/${scan.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Search className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium truncate max-w-[200px]">
                          {scan.configuration.replace('_', ' ').toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={scanStatusColors[scan.status]}>
                      {scan.status === 'running' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Findings by Severity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Findings by Severity</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/findings">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard?.findings.total === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No findings yet</p>
                <p className="text-sm">Run a scan to discover issues</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { key: 'critical', label: 'Critical', icon: XCircle, color: 'text-destructive' },
                  { key: 'high', label: 'High', icon: AlertTriangle, color: 'text-orange-500' },
                  { key: 'medium', label: 'Medium', icon: AlertTriangle, color: 'text-yellow-500' },
                  { key: 'low', label: 'Low', icon: AlertTriangle, color: 'text-blue-500' },
                  { key: 'info', label: 'Info', icon: AlertTriangle, color: 'text-gray-500' },
                ].map((sev) => {
                  const count = dashboard?.findings.by_severity[sev.key as keyof typeof dashboard.findings.by_severity] || 0;
                  return (
                    <div key={sev.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <sev.icon className={`h-5 w-5 ${sev.color}`} />
                        <span className="capitalize">{sev.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-semibold">{count}</span>
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(dashboard?.findings?.total ?? 0) > 0 ? (count / (dashboard?.findings?.total ?? 0)) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Repositories & Recent Findings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Repositories */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Repositories</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/repositories">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentRepos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No repositories yet</p>
                <Button className="mt-4" asChild>
                  <Link href="/repositories/new">Add your first repository</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRepos.map((repo) => (
                  <Link
                    key={repo.id}
                    href={`/repositories/${repo.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <GitBranch className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{repo.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {repo.source_type.toUpperCase()} • {formatDistanceToNow(new Date(repo.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusColors[repo.status] || 'bg-gray-100 text-gray-600'}>
                      {repo.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Findings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Findings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/findings">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentFindings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No findings yet</p>
                <p className="text-sm">Run a scan to discover issues</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentFindings.map((finding) => (
                  <Link
                    key={finding.id}
                    href={`/findings/${finding.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${severityColors[finding.severity]}`}>
                        <Bug className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{finding.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {finding.file_path}:{finding.line_start || '?'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={severityColors[finding.severity]}>
                        {finding.severity}
                      </Badge>
                      <Badge variant="outline" className={statusColors[finding.status]}>
                        {finding.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" className="h-24 flex-col gap-2" asChild>
            <Link href="/repositories/new">
              <GitBranch className="h-8 w-8" />
              <span>Add Repository</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-24 flex-col gap-2" asChild>
            <Link href="/scans/new">
              <Search className="h-8 w-8" />
              <span>New Scan</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-24 flex-col gap-2" asChild>
            <Link href="/findings">
              <Bug className="h-8 w-8" />
              <span>Browse Findings</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-24 flex-col gap-2" asChild>
            <Link href="/settings">
              <Settings className="h-8 w-8" />
              <span>Settings</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}