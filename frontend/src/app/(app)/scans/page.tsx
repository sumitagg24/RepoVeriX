'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, MoreHorizontal, Plus, Search, Terminal, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCancelScan, useCreateScan, useScans } from '@/hooks/useScans';
import { useRepositories } from '@/hooks/useRepositories';
import { LLM_LEAD_CONFIGS, usePlan } from '@/hooks/usePlan';
import { formatDuration } from '@/lib/evidence';
import { ScanStatus } from '@/components/system/status';
import { QueryError } from '@/components/ui/state';
import { ConsoleEmpty, ConsoleSkeleton } from '@/components/rvx/primitives';
import { RvxLedger } from '@/components/rvx/surface';

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

  useEffect(() => {
    if (planReady && isFree) {
      const current = form.getValues('configuration');
      if (LLM_LEAD_CONFIGS.has(current)) {
        form.setValue('configuration', 'static_llm');
      }
    }
  }, [planReady, isFree, form]);

  const repoName = useMemo(
    () => new Map((repositories ?? []).map((repo) => [repo.id, repo.name])),
    [repositories]
  );

  const filteredScans = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (
      scans?.filter((scan) => {
        return (
          scan.configuration.toLowerCase().includes(q) ||
          (repoName.get(scan.repository_id) ?? '').toLowerCase().includes(q) ||
          scan.status.toLowerCase().includes(q)
        );
      }) ?? []
    );
  }, [scans, searchQuery, repoName]);

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rvx-eyebrow">Analysis</p>
          <h1 className="rvx-title mt-2 text-2xl sm:text-3xl">Scans</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Queue, progress and outcomes for every analysis run. New scans still use the same
            configuration API as before.
          </p>
        </div>
        <Button disabled={repositories?.length === 0 || reposLoading} onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New scan
        </Button>
      </header>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Start new scan</DialogTitle>
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
                    <FormLabel>Scan configuration</FormLabel>
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
                                {premium && (
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    Pro
                                  </Badge>
                                )}
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
                <Button
                  type="submit"
                  disabled={createMutation.isPending || repositories?.length === 0}
                  className="w-full"
                >
                  {createMutation.isPending ? 'Starting...' : 'Start scan'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search scans"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
          aria-label="Search scans"
        />
      </div>

      {scansLoading || reposLoading ? (
        <ConsoleSkeleton rows={5} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => refetchScans()} />
      ) : filteredScans.length === 0 ? (
        <ConsoleEmpty
          title={searchQuery ? `No scans match “${searchQuery}”` : 'No scans yet'}
          body={
            searchQuery
              ? 'Try a configuration name, repository or status — or clear the search.'
              : 'Start your first scan to analyze a repository with the evidence pipeline.'
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
        <RvxLedger
          header={
            <div className="hidden grid-cols-[minmax(0,1.4fr)_8rem_7rem_minmax(0,1fr)_auto] gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <span>Repository</span>
              <span>Configuration</span>
              <span>Status</span>
              <span>When</span>
              <span className="text-right">Actions</span>
            </div>
          }
        >
          {filteredScans.map((scan) => (
            <div key={scan.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1.4fr)_8rem_7rem_minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <Link href={`/scans/${scan.id}`} className="truncate text-sm font-medium hover:text-primary">
                  {repoName.get(scan.repository_id) ?? 'Repository'}
                </Link>
                {scan.error ? (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    {scan.error}
                  </p>
                ) : null}
              </div>
              <span className="rvx-mono text-[11px] text-muted-foreground">
                {scan.configuration.replaceAll('_', ' ')}
              </span>
              <ScanStatus status={scan.status} />
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })} · ran{' '}
                {formatDuration(scan.started_at, scan.finished_at)}
              </p>
              <div className="flex items-center justify-end gap-2">
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
                    <button
                      className="rounded-lg p-2 transition-colors hover:bg-accent"
                      aria-label={`Actions for scan of ${repoName.get(scan.repository_id) ?? 'repository'}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/scans/${scan.id}`}>
                        <Terminal className="mr-2 h-4 w-4" />
                        View details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/findings?scan_id=${scan.id}`}>
                        <Search className="mr-2 h-4 w-4" />
                        View findings
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
          ))}
        </RvxLedger>
      )}
    </div>
  );
}
