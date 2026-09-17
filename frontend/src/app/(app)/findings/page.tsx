'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MoreHorizontal, Filter, X, AlertTriangle, Shield, Bug, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import { useFindings } from '@/hooks/useFindings';
import { useScans } from '@/hooks/useScans';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
const categories = ['security', 'logic', 'api_misuse', 'database', 'dependency', 'reliability'] as const;
const statuses = ['verified', 'probable', 'rejected'] as const;

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

const sourceColors: Record<string, string> = {
  static: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  llm: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  hybrid: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
};

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
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  // Dashboard “Group: Status” pills deep-link here (?status=verified|probable).
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const param = searchParams.get('status') ?? '';
    return (statuses as readonly string[]).includes(param) ? param : '';
  });
  const [scanFilter, setScanFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<string>('list');

  const { data: scans } = useScans();
  const {
    data: findings,
    isLoading,
    refetch,
  } = useFindings({
    severity: severityFilter || undefined,
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    scan_id: scanFilter || undefined,
    limit: 50,
  });

  const hasActiveFilters = severityFilter || categoryFilter || statusFilter || scanFilter;

  const clearFilters = () => {
    setSeverityFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setScanFilter('');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Findings</h1>
            <p className="text-muted-foreground">Browse and analyze discovered issues</p>
          </div>
        </div>
        <div className="space-y-4 p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Findings</h1>
          <p className="text-muted-foreground">Browse and analyze discovered issues</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasActiveFilters}>
            <X className="mr-1 h-3 w-3" />
            Clear Filters
          </Button>
        </div>
      </div>

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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Severities</SelectItem>
                {severities.map((s) => (
                  <SelectItem key={s} value={s}>
                    <Badge variant="outline" className={severityColors[s]}>{s}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    <Badge variant="outline" className={statusColors[s]}>{s}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scanFilter} onValueChange={setScanFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Scan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Scans</SelectItem>
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
                <div className="text-center py-12">
                  <Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No findings found</h3>
                  <p className="text-muted-foreground">
                    {hasActiveFilters ? 'Try adjusting your filters' : 'Run a scan to discover issues'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
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
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={`p-3 rounded-lg flex-shrink-0 ${severityColors[finding.severity]}`}>
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/findings/${finding.id}`} className="font-medium truncate hover:text-primary">
                                {finding.title}
                              </Link>
                              <Badge variant="outline" className={severityColors[finding.severity]}>
                                {finding.severity}
                              </Badge>
                              <Badge variant="outline" className={statusColors[finding.status]}>
                                {finding.status}
                              </Badge>
                              <Badge variant="outline" className={sourceColors[finding.source]}>
                                {finding.source}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                              <span className="font-mono truncate max-w-[300px]">
                                {finding.file_path}:{finding.line_start || '?'}
                              </span>
                              <span>{finding.category.replace('_', ' ')}</span>
                              <span>{formatDistanceToNow(new Date(finding.created_at), { addSuffix: true })}</span>
                              <span>Confidence: {(finding.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/findings/${finding.id}`}>
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/scans/${finding.scan_id}`}>
                                  View Scan
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                <Card key={sev} className={severityColors[sev]}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{sev.charAt(0).toUpperCase() + sev.slice(1)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{count}</div>
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
                    <div key={st} className={`p-4 rounded-lg ${statusColors[st]}`}>
                      <div className="font-medium capitalize mb-1">{st}</div>
                      <div className="text-2xl font-bold">{count}</div>
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