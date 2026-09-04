'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateScan } from '@/hooks/useScans';
import { useRepositories } from '@/hooks/useRepositories';
import { Search, Loader2, ArrowLeft, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

const scanConfigurations = [
  { value: 'repoverix', label: 'RepoVeriX (Full Pipeline)', description: 'Complete evidence-grounded analysis with automated verification' },
  { value: 'static_llm', label: 'Static + LLM', description: 'Hybrid static analysis and LLM reasoning' },
  { value: 'static_only', label: 'Static Only', description: 'Traditional SAST tools only' },
  { value: 'llm_only', label: 'LLM Only', description: 'Pure LLM-based semantic analysis' },
] as const;

const scanSchema = z.object({
  repository_id: z.string().uuid('Please select a repository'),
  configuration: z.enum(['repoverix', 'static_llm', 'static_only', 'llm_only']).default('repoverix'),
});

type ScanForm = z.infer<typeof scanSchema>;

function NewScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedRepo = searchParams.get('repo');
  
  const createMutation = useCreateScan();
  const { data: repositories, isLoading: reposLoading } = useRepositories();

  const form = useForm<ScanForm>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      repository_id: preSelectedRepo || '',
      configuration: 'repoverix',
    },
  });

  const onSubmit = async (data: ScanForm) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Scan started successfully');
      router.push('/scans');
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start scan';
      toast.error(message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/scans" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to Scans
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Start New Scan</h1>
        <p className="text-muted-foreground">Select a repository and configuration to begin scanning</p>
      </div>

      {reposLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Loading repositories...</p>
          </CardContent>
        </Card>
      )}

      {!reposLoading && repositories?.length === 0 && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="text-center py-4">
              <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No repositories found</h3>
              <p className="text-muted-foreground mb-4">You need to add a repository before starting a scan</p>
              <Button asChild>
                <Link href="/repositories/new">Add Repository</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!reposLoading && repositories && repositories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Configuration</CardTitle>
            <CardDescription>Select a repository and configuration to begin scanning</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="scan-form">
                <FormField
                  control={form.control}
                  name="repository_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={createMutation.isPending}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a repository" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {repositories.map((repo) => (
                            <SelectItem key={repo.id} value={repo.id}>
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-4 w-4" />
                                <span>{repo.name} ({repo.source_type})</span>
                              </div>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={createMutation.isPending}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select configuration" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {scanConfigurations.map((config) => (
                            <SelectItem key={config.value} value={config.value}>
                              <div className="space-y-1 min-w-[280px]">
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
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/scans">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" form="scan-form" disabled={createMutation.isPending || !repositories?.length} className="w-full sm:w-auto">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Scan...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Start Scan
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      <Card className="border-info/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Scan Configurations Explained
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scanConfigurations.map((config) => (
            <div key={config.value} className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewScanPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto space-y-6"><div className="h-8 bg-muted animate-pulse rounded w-1/4" /></div>}>
      <NewScanPageContent />
    </Suspense>
  );
}