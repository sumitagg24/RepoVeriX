'use client';

import { useState } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, MoreHorizontal, Play, RefreshCw, X, Trash2, ExternalLink, Loader2, Clock, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';
import { useScans, useCreateScan, useCancelScan } from '@/hooks/useScans';
import { useRepositories } from '@/hooks/useRepositories';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

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

const scanStatusLabels: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

const scanStatusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

const scanStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

export default function ScansPage() {
  const { data: scans, isLoading: scansLoading, refetch: refetchScans } = useScans();
  const { data: repositories, isLoading: reposLoading } = useRepositories();
  const createMutation = useCreateScan();
  const cancelMutation = useCancelScan();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const form = useForm<ScanForm>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      repository_id: '',
      configuration: 'repoverix',
    },
  });

  const filteredScans = scans?.filter((scan) =>
    scan.configuration.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scan? This action cannot be undone.')) return;
    // Note: DELETE endpoint not implemented in backend yet
    toast.error('Delete not implemented yet');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scans</h1>
          <p className="text-muted-foreground">Manage and monitor repository scans</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={repositories?.length === 0 || reposLoading}>
              <Plus className="mr-2 h-4 w-4" />
              New Scan
            </Button>
          </DialogTrigger>
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
                          {scanConfigurations.map((config) => (
                            <SelectItem key={config.value} value={config.value}>
                              <div className="space-y-1">
                                <p className="font-medium">{config.label}</p>
                                <p className="text-xs text-muted-foreground">{config.description}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
      </div>

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
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="text-center py-12">
              <Terminal className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No scans found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Start your first scan to analyze a repository'}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <DialogTrigger>
                    <Link href="#">New Scan</Link>
                  </DialogTrigger>
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredScans.map((scan) => (
                <div key={scan.id} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-3 rounded-lg flex-shrink-0 ${scanStatusColors[scan.status]}`}>
                        {scanStatusIcons[scan.status]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <Link href={`/scans/${scan.id}`} className="font-medium truncate block hover:text-primary">
                            {scan.configuration.replace('_', ' ').toUpperCase()}
                          </Link>
                          <Badge variant="outline" className={scanStatusColors[scan.status]}>
                            {scanStatusIcons[scan.status]}
                            {scanStatusLabels[scan.status]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}</span>
                          {scan.started_at && (
                            <span>Started {formatDistanceToNow(new Date(scan.started_at), { addSuffix: true })}</span>
                          )}
                          {scan.finished_at && (
                            <span>Finished {formatDistanceToNow(new Date(scan.finished_at), { addSuffix: true })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {scan.status === 'running' && (
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
                          <button className="p-2 hover:bg-accent rounded-lg transition-colors">
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
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(scan.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {scan.error && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                      Error: {scan.error}
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