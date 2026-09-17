'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, MoreHorizontal, X, ExternalLink, Terminal, ScanSearch } from 'lucide-react';
import { useScans, useCreateScan, useCancelScan } from '@/hooks/useScans';
import { useRepositories } from '@/hooks/useRepositories';
import { usePlan, LLM_LEAD_CONFIGS } from '@/hooks/usePlan';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { formatDuration } from '@/lib/verdict';
import { PageHeader } from '@/components/system/page-header';
import { ScanStatus } from '@/components/system/status';
import { EmptyState, ListSkeleton, QueryError } from '@/components/ui/state';

const scanConfigurations = [
  { value: 'repoverix', label: 'RepoVeriX (Full Pipeline)', description: 'Complete evidence-grounded analysis with verification' },
  { value: 'static_llm', label: 'Static + LLM', description: 'Hybrid static analysis and LLM reasoning' },
  { value: 'static_only', label: 'Static Only', description: 'Traditional SAST tools only' },
  { value: 'llm_only', label: 'LLM Only', description: 'Pure LLM-based semantic analysis' },
] as const;

const scanSchema = z.object({
  repository_id: z.string().uuid('Please select a repository'),
  configuration: z.enum(['repoverix', 'static_llm', 'static_only', 'llm_only']).default('repoverix'),
});

type ScanForm = z.infer<typeof scanSchema>;

export default function ScansPage() {
  const { data: scans, isLoading: scansLoading, isError, error, refetch: refetchScans } = useScans();
  const { data: repositories, isLoading: reposLoading } = useRepositories();
  const createMutation = useCreateScan();
  const cancelMutation = useCancelScan();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isFree, ready: planReady } = usePlan();

  const form = useForm<ScanForm>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      repository_id: '',
      configuration: 'repoverix',
    },
  });

  // Free accounts cannot run the LLM-led configurations.
  useEffect(() => {
    if (planReady && isFree) {
      const current = form.getValues('configuration');
      if (LLM_LEAD_CONFIGS.has(current)) {
        form.setValue('configuration', 'static_llm');
      }
    }
  }, [planReady, isFree, form]);

  const repoName = new Map((repositories ?? []).map((r) => [r.id, r.name]));

  const filteredScans = scans?.filter((scan) => {
    const q = searchQuery.toLowerCase();
    return (
      scan.configuration.toLowerCase().includes(q) ||
      (repoName.get(scan.repository_id) ?? '').toLowerCase().includes(q) ||
      scan.status.toLowerCase().includes(q)
    );
  }) || [];

  const onSubmit = async (data: ScanForm) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Scan started successfully');
      setDialogOpen(false);
      form.reset();
      refetchScans();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start scan';
      toast.error(message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scan?')) return;
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Scan cancelled');
      refetchScans();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to cancel scan';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis"
        title="Scans"
        description="Every analysis run: configuration, lifecycle, duration and outcome. Scans run in the background."
        actions={
          <Button disabled={repositories?.length === 0 || reposLoading} onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Scan
          </Button>
        }
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Start New Scan</DialogTitle>
              <DialogDescription>Select a repository and configuration to begin scanning</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="repository_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a repository" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {repositories?.map((repo) => (
                            <SelectItem key={repo.id} value={repo.id}>
                              {repo.name} ({repo.source_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="configuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scan Configuration</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select configuration" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {scanConfigurations.map((config) => {
                            const premium = LLM_LEAD_CONFIGS.has(config.value);
                            return (
                              <SelectItem
                                key={config.value}
                                value={config.value}
                                disabled={planReady && isFree && premium}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="font-medium">{config.label}</p>
                                    <p className="text-xs text-muted-foreground">{config.description}</p>
                                  </div>
                                  {premium && <Badge variant="outline" className="shrink-0 text-[10px]">Pro</Badge>}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {planReady && isFree && (
                        <FormDescription>
                          The full-pipeline and LLM-only configurations are Pro features — Free scans run
                          hybrid or static analysis.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || repositories?.length === 0} className="w-full">
                    {createMutation.isPending ? 'Starting...' : 'Start Scan'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search scans..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Scans List */}
      <Card>
        <CardContent className="p-0">
          {(scansLoading || reposLoading) ? (
            <ListSkeleton rows={3} />
          ) : isError ? (
            <QueryError error={error} onRetry={() => refetchScans()} />
          ) : filteredScans.length === 0 ? (
            <EmptyState
              icon={ScanSearch}
              title={searchQuery ? `No scans match “${searchQuery}”` : 'No scans yet'}
              body={
                searchQuery
                  ? 'Try a configuration name, repository or status — or clear the search.'
                  : 'Start your first scan to analyze a repository with the full evidence pipeline.'
              }
              action={
                searchQuery ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> New scan
                  </Button>
                )
              }
            />
          ) : (
            <div className="divide-y divide-border/60">
              {filteredScans.map((scan) => (
                <div key={scan.id} className="data-row p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ScanSearch className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/scans/${scan.id}`} className="truncate text-sm font-medium hover:text-primary">
                            {repoName.get(scan.repository_id) ?? 'Repository'}
                          </Link>
                          <span className="mono-label">
                            {scan.configuration.replaceAll('_', ' ')}
                          </span>
                          <ScanStatus status={scan.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })} · ran {formatDuration(scan.started_at, scan.finished_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(scan.status === 'running' || scan.status === 'pending') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(scan.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Cancel
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-lg p-2 transition-colors hover:bg-accent" aria-label={`Actions for scan of ${repoName.get(scan.repository_id) ?? 'repository'}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/scans/${scan.id}`}>
                              <Terminal className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/findings?scan_id=${scan.id}`}>
                              <Search className="mr-2 h-4 w-4" />
                              View Findings
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/repositories/${scan.repository_id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open repository
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {scan.error && (
                    <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                      {scan.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}