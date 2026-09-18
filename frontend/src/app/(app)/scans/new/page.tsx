'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, GitBranch, Loader2, Search, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { useCreateScan } from '@/hooks/useScans';
import { useRepositories } from '@/hooks/useRepositories';
import { LLM_LEAD_CONFIGS, usePlan } from '@/hooks/usePlan';
import { StageTag } from '@/components/rvx/primitives';
import { RvxHeader, RvxLedger, RvxSurface } from '@/components/rvx/surface';

const scanConfigurations = [
  {
    value: 'repoverix',
    label: 'RepoVeriX full pipeline',
    description: 'Evidence-grounded analysis with repair and verification affordances.',
    depth: 'source, transform, sink, patch, verify',
  },
  {
    value: 'static_llm',
    label: 'Static + LLM',
    description: 'Static detectors plus semantic reasoning over the repository context.',
    depth: 'source, transform, sink',
  },
  {
    value: 'static_only',
    label: 'Static only',
    description: 'Deterministic rules without LLM-led reasoning.',
    depth: 'source, sink',
  },
  {
    value: 'llm_only',
    label: 'LLM only',
    description: 'Semantic analysis without deterministic rule confirmation.',
    depth: 'hypothesis, review',
  },
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
  const { isFree, ready: planReady } = usePlan();

  const form = useForm<ScanForm>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      repository_id: preSelectedRepo || '',
      configuration: 'repoverix',
    },
  });

  const onSubmit = async (data: ScanForm) => {
    const payload: ScanForm =
      planReady && isFree && LLM_LEAD_CONFIGS.has(data.configuration)
        ? { ...data, configuration: 'static_llm' }
        : data;
    try {
      await createMutation.mutateAsync(payload);
      toast.success('Analysis started');
      router.push('/scans');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis');
    }
  };

  return (
    <div className="space-y-8">
      <Link
        href="/scans"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to analysis runs
      </Link>

      <RvxHeader
        kicker="Launch analysis"
        title="Choose the repository and depth of evidence."
        body="A scan is not just a background job. It determines how much of the source-to-verified path RepoVeriX can show when findings come back."
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <RvxSurface className="p-5 sm:p-6">
          {reposLoading ? (
            <div className="flex min-h-[18rem] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Loading repositories
            </div>
          ) : repositories?.length === 0 ? (
            <div className="py-10 text-center">
              <GitBranch className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
              <h2 className="rvx-title mt-4 text-xl">Import a repository first</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                RepoVeriX needs code to index before it can trace a finding or verify a repair.
              </p>
              <Button asChild className="mt-5">
                <Link href="/repositories?import=1">Import repository</Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  form.handleSubmit(onSubmit, (errors) =>
                    toast.error(Object.values(errors)[0]?.message ?? 'Please check the form')
                  )();
                }}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="repository_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={createMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a repository" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {repositories?.map((repo) => (
                            <SelectItem key={repo.id} value={repo.id}>
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-4 w-4" aria-hidden="true" />
                                <span>
                                  {repo.name} ({repo.source_type})
                                </span>
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
                      <FormLabel>Analysis depth</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={createMutation.isPending}
                      >
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
                                <div className="min-w-[18rem] space-y-1">
                                  <p className="font-medium">{config.label}</p>
                                  <p className="text-xs text-muted-foreground">{config.description}</p>
                                  <p className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                    {config.depth}
                                    {premium ? ' - pro' : ''}
                                  </p>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {planReady && isFree ? (
                        <FormDescription>
                          Free accounts run hybrid or static analysis. LLM-led modes unlock on Pro.
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col-reverse gap-3 border-t pt-5 rvx-hairline sm:flex-row sm:justify-between">
                  <Button asChild variant="outline">
                    <Link href="/scans">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Start analysis
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </RvxSurface>

        <div className="space-y-5">
          <RvxLedger
            header={
              <div className="flex items-center justify-between gap-3">
                <span className="rvx-eyebrow">Pipeline preview</span>
                <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  source to verified
                </span>
              </div>
            }
          >
            {(['source', 'transform', 'sink', 'patch', 'verify'] as const).map((stage, index) => (
              <div key={stage} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
                <StageTag stage={stage} />
                <span className="text-sm capitalize">
                  {stage === 'verify' ? 'sandbox verification' : `${stage} evidence`}
                </span>
                <span className="rvx-mono text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
            ))}
          </RvxLedger>

          <RvxSurface className="p-5">
            <div className="flex items-start gap-3">
              <ScanSearch
                className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--rvx-source))]"
                aria-hidden="true"
              />
              <div>
                <h2 className="rvx-title text-base">What happens after launch</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The scan starts server-side and appears in the analysis ledger. You can leave this
                  screen; progress, findings and verification outcomes stay attached to the
                  repository.
                </p>
              </div>
            </div>
          </RvxSurface>
        </div>
      </div>
    </div>
  );
}

export default function NewScanPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="h-80 animate-pulse rounded-[var(--radius-lg)] bg-muted/50" />
        </div>
      }
    >
      <NewScanPageContent />
    </Suspense>
  );
}
