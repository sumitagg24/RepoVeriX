'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, X, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { useFindings } from '@/hooks/useFindings';
import { useScans } from '@/hooks/useScans';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatConfidence } from '@/lib/verdict';
import { FindingStateChip, SeverityChip } from '@/components/evidence';
import { EmptyState, QueryError, ListSkeleton } from '@/components/ui/state';
import { PageHeader } from '@/components/system/page-header';

const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
const categories = ['security', 'logic', 'api_misuse', 'database', 'dependency', 'reliability'] as const;
const statuses = ['verified', 'probable', 'rejected'] as const;

/** Radix Select forbids empty-string values — "all" means no filter. */
const ALL = 'all';

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      }
    >
      <FindingsPageInner />
    </Suspense>
  );
}

function FindingsPageInner() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const paramIn = (key: string, valid: readonly string[]) => {
    const v = searchParams.get(key) ?? ALL;
    return (valid as readonly string[]).includes(v) ? v : ALL;
  };
  const [severityFilter, setSeverityFilter] = useState<string>(() => paramIn('severity', severities));
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  // Dashboard “Group: Status” pills and scan pages deep-link here
  // (?status=verified|probable, ?scan_id=<uuid>).
  const [statusFilter, setStatusFilter] = useState<string>(() => paramIn('status', statuses));
  const [scanFilter, setScanFilter] = useState<string>(() => {
    const v = searchParams.get('scan_id');
    return v && v.length > 0 ? v : ALL;
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<string>('list');

  const { data: scans } = useScans();
  const {
    data: findings,
    isLoading,
    isError,
    error,
    refetch,
  } = useFindings({
    severity: severityFilter === ALL ? undefined : severityFilter,
    category: categoryFilter === ALL ? undefined : categoryFilter,
    status: statusFilter === ALL ? undefined : statusFilter,
    scan_id: scanFilter === ALL ? undefined : scanFilter,
    limit: 50,
  });

  const hasActiveFilters =
    severityFilter !== ALL || categoryFilter !== ALL || statusFilter !== ALL || scanFilter !== ALL;

  const clearFilters = () => {
    setSeverityFilter(ALL);
    setCategoryFilter(ALL);
    setStatusFilter(ALL);
    setScanFilter(ALL);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="type-page-title">Findings</h1>
            <p className="text-muted-foreground">Browse and analyze discovered issues</p>
          </div>
        </div>
        <Card>
          <ListSkeleton rows={5} />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="type-page-title">Findings</h1>
          <p className="text-muted-foreground">Browse and analyze discovered issues</p>
        </div>
        <Card>
          <QueryError error={error} onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  const filteredFindings = findings?.filter((finding) =>
    finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    finding.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    finding.file_path.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Review"
        title="Findings"
        description="Every issue the pipeline reported, with severity, confidence and verification state. Findings are investigation objects — open one to see why it exists."
        actions={
          <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasActiveFilters}>
            <X className="mr-1 h-3 w-3" />
            Clear filters
          </Button>
        }
      />

      {/* Filters */}
      <Card className={cn(!hasActiveFilters && 'border-muted/50')}>
        <CardContent className="pt-4 pb-2">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Severities</SelectItem>
                {severities.map((s) => (
                  <SelectItem key={s} value={s}>
                    <SeverityChip severity={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by validation status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    <FindingStateChip state={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scanFilter} onValueChange={setScanFilter}>
              <SelectTrigger className="w-[200px]" aria-label="Filter by scan">
                <SelectValue placeholder="Scan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Scans</SelectItem>
                {scans?.map((scan) => (
                  <SelectItem key={scan.id} value={scan.id}>
                    {scan.configuration} - {new Date(scan.created_at).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {filteredFindings.length === 0 ? (
                <EmptyState
                  icon={hasActiveFilters ? Search : Bug}
                  title="No findings found"
                  body={
                    hasActiveFilters
                      ? 'No findings match these filters. Adjust or clear them to see more.'
                      : 'Run a scan to discover issues with evidence.'
                  }
                  ctaHref={hasActiveFilters ? undefined : '/scans/new'}
                  ctaLabel={hasActiveFilters ? undefined : 'Start a scan'}
                />
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredFindings
                    .sort((a, b) => {
                      const dateA = new Date(a.created_at).getTime();
                      const dateB = new Date(b.created_at).getTime();
                      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                    })
                    .map((finding) => (
                      <Link
                        key={finding.id}
                        href={`/findings/${finding.id}`}
                        className="data-row flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <SeverityChip severity={finding.severity} />
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-medium hover:text-primary">
                              {finding.title}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                              {finding.file_path}:{finding.line_start || '?'} · {finding.category.replace('_', ' ')} · confidence {formatConfidence(finding.confidence)} · {formatDistanceToNow(new Date(finding.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <FindingStateChip state={finding.status} />
                          <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
                            {finding.source}
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {severities.map((sev) => {
              const count = findings?.filter(f => f.severity === sev).length || 0;
              return (
                <Card key={sev} className="border">
                  <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium">{sev.charAt(0).toUpperCase() + sev.slice(1)}</CardTitle>
                    <SeverityChip severity={sev} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tabular-nums">{count}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Findings by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {categories.map((cat) => {
                  const count = findings?.filter(f => f.category === cat).length || 0;
                  return (
                    <div key={cat} className="p-4 bg-muted/50 rounded-lg">
                      <div className="font-medium capitalize mb-1">{cat.replace('_', ' ')}</div>
                      <div className="text-2xl font-bold">{count}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Findings by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {statuses.map((st) => {
                  const count = findings?.filter(f => f.status === st).length || 0;
                  return (
                    <div key={st} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium capitalize">{st}</div>
                        <FindingStateChip state={st} />
                      </div>
                      <div className="text-2xl font-bold tabular-nums">{count}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}