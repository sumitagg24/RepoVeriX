'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Info, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input } from '@/components/ui/field';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, InlineError, LoadingRegion } from '@/components/ui/states';
import { useBilling } from '@/hooks/use-platform';
import { useRepositories } from '@/hooks/use-repositories';
import { useCreateScan } from '@/hooks/use-scans';
import { SCAN_CONFIGURATIONS } from '@/lib/domain';
import { toApiFailure } from '@/services/api';
import type { ScanConfiguration } from '@/types/api';

/**
 * New scan.
 *
 * Two decisions, in the order they matter: which repository, and which
 * configuration. The configuration cards state what each one actually runs and
 * whether it needs a model provider, so nobody discovers the requirement after
 * submitting. Configurations the current plan excludes are shown and explained
 * rather than hidden, because the backend refuses them with a reason and the
 * UI should say the same thing first.
 *
 * Submission carries an idempotency key so a double click cannot start two runs.
 */
export default function NewScanPage() {
  const router = useRouter();
  const repositories = useRepositories();
  const billing = useBilling();
  const createScan = useCreateScan();

  const [repositoryId, setRepositoryId] = React.useState('');
  const [configuration, setConfiguration] = React.useState<ScanConfiguration>('static_only');
  const [error, setError] = React.useState<string | null>(null);
  const idempotencyKey = React.useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
  );

  const available = repositories.data ?? [];
  const llmEnabled = billing.data?.plan.llm_enabled ?? true;

  // Default to the deepest configuration the plan allows, so the common case is
  // one click rather than a settings decision.
  React.useEffect(() => {
    if (billing.data) setConfiguration(billing.data.plan.llm_enabled ? 'repoverix' : 'static_only');
  }, [billing.data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!repositoryId) {
      setError('Choose the repository to scan.');
      return;
    }
    try {
      const scan = await createScan.mutateAsync({
        payload: { repository_id: repositoryId, configuration },
        idempotencyKey: idempotencyKey.current,
      });
      toast.success('Scan queued');
      router.push(`/scans/${scan.id}`);
    } catch (caught) {
      setError(toApiFailure(caught).message);
    }
  };

  return (
    <AppPage>
      <PageHeader
        title="New scan"
        crumbs={[{ href: '/scans', label: 'Scans' }, { label: 'New scan' }]}
        description="A scan reads a stored snapshot of the repository and runs the analysis pipeline on it. Your working copy is never touched."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/scans">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to scans
            </Link>
          </Button>
        }
      />

      {repositories.isLoading ? <LoadingRegion label="Loading repositories" /> : null}

      {repositories.isError ? (
        <ErrorState
          title="Could not load repositories"
          body="The scan form needs the repository list before it can submit."
          onRetry={() => void repositories.refetch()}
        />
      ) : null}

      {!repositories.isLoading && !repositories.isError && available.length === 0 ? (
        <EmptyState
          icon={<ScanSearch className="size-4" aria-hidden="true" />}
          title="There is nothing to scan yet"
          body="A scan runs against an imported repository. Import one first, then come back to this page."
          action={
            <Button asChild size="sm" variant="primary">
              <Link href="/repositories/new">Import a repository</Link>
            </Button>
          }
        />
      ) : null}

      {available.length > 0 ? (
        <form onSubmit={submit} className="space-y-6">
          <Panel>
            <PanelHeader
              title="Repository"
              hint="Only repositories that finished importing can be scanned."
            />
            <div className="px-5 py-5 sm:px-6">
              <Field
                label="Repository"
                hint="Importing must be complete: the scan reads the snapshot written during import."
                error={error && !repositoryId ? error : undefined}
              >
                {(fieldProps) => (
                  <Select value={repositoryId} onValueChange={setRepositoryId}>
                    <SelectTrigger id={fieldProps.id} aria-describedby={fieldProps['aria-describedby']}>
                      <SelectValue placeholder="Choose a repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((repository) => (
                        <SelectItem key={repository.id} value={repository.id}>
                          {repository.name} · {repository.default_branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              {repositoryId ? (
                <p className="mt-3 text-[12.5px] text-muted">
                  Already scanned this repository? Older runs stay in the list at{' '}
                  <Link href="/scans" className="text-accent">
                    Scans
                  </Link>
                  , and each one keeps its own findings.
                </p>
              ) : null}
            </div>
          </Panel>

          <fieldset>
            <legend className="sr-only">Scan configuration</legend>
            <Panel>
              <PanelHeader
                title="Configuration"
                hint="What runs, in order of how much it costs and how much it proves."
              />
              <div className="grid grid-cols-1 gap-3 px-5 py-5 sm:px-6 lg:grid-cols-2">
                {SCAN_CONFIGURATIONS.map((option) => {
                  const blocked = option.needsLlm && !llmEnabled;
                  const selected = configuration === option.value;
                  return (
                    <label
                      key={option.value}
                      className={[
                        'flex cursor-pointer flex-col gap-2 rounded-md border p-4 transition-colors',
                        selected
                          ? 'border-accent bg-accent-soft'
                          : 'border-hairline bg-card hover:border-hairline-strong',
                        blocked ? 'cursor-not-allowed opacity-70' : '',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="configuration"
                          value={option.value}
                          checked={selected}
                          disabled={blocked}
                          onChange={() => setConfiguration(option.value)}
                          className="size-4 accent-[var(--tint-accent)]"
                        />
                        <span className="text-[14px] font-medium text-ink">{option.label}</span>
                        {option.value === 'repoverix' ? <Badge tone="accent">Full pipeline</Badge> : null}
                        {option.needsLlm ? (
                          <Badge tone={blocked ? 'medium' : 'neutral'}>Needs a model provider</Badge>
                        ) : null}
                      </span>
                      <span className="text-[13px] leading-relaxed text-body">{option.blurb}</span>
                      <span className="text-[12.5px] leading-relaxed text-muted">{option.detail}</span>
                      {blocked ? (
                        <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-high">
                          <Info className="size-3.5" aria-hidden="true" />
                          Not included in your current plan.
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </Panel>
          </fieldset>

          {!llmEnabled ? (
            <Callout
              tone="info"
              title="Model-backed configurations are not in this plan"
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href="/billing">
                    Compare plans
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              }
            >
              Static only runs the deterministic detectors with no provider calls. It is the fastest
              configuration and it still produces findings with evidence chains where the detectors
              record one.
            </Callout>
          ) : null}

          {error && repositoryId ? <InlineError>{error}</InlineError> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" variant="primary" loading={createScan.isPending}>
              <ScanSearch className="size-4" aria-hidden="true" />
              Start scan
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/scans">Cancel</Link>
            </Button>
            <Input type="hidden" name="idempotency-key" value={idempotencyKey.current} readOnly />
          </div>
        </form>
      ) : null}
    </AppPage>
  );
}
