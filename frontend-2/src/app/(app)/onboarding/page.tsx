'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, CircleDashed, Plug, ScanSearch, Database, FileSearch, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState, LoadingRegion } from '@/components/ui/states';
import { useCompleteOnboarding, useOAuthConnections, useOnboarding } from '@/hooks/use-platform';
import { useRepositories } from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';
import { relativeTime } from '@/lib/dates';

/**
 * First run.
 *
 * Five steps, each one tied to a record the API already keeps: a provider
 * connection, an imported repository, a completed scan, and a finding to read.
 * Progress is read from the onboarding status endpoint rather than guessed from
 * local state, so leaving and returning shows the truth.
 */
const STEPS = [
  {
    key: 'connect_provider',
    title: 'Connect a source',
    body: 'Authorise GitHub or GitLab to list repositories, or skip it and import a Git URL, an archive URL or a ZIP.',
    href: '/settings/integrations',
    action: 'Open integrations',
    icon: Plug,
  },
  {
    key: 'add_repository',
    title: 'Choose a repository',
    body: 'Import the code to scan. The import stores a snapshot, so scanning never touches the source.',
    href: '/repositories/new',
    action: 'Import repository',
    icon: Database,
  },
  {
    key: 'run_first_scan',
    title: 'Run the first scan',
    body: 'Static only is the fastest and needs no model provider. The RepoVeriX configuration adds reasoning and validation.',
    href: '/scans/new',
    action: 'Start a scan',
    icon: ScanSearch,
  },
  {
    key: 'read_finding',
    title: 'Read a finding',
    body: 'Every finding carries its file, its lines and the evidence chain that produced the claim.',
    href: '/findings',
    action: 'Open findings',
    icon: FileSearch,
  },
] as const;

export default function OnboardingPage() {
  const onboarding = useOnboarding();
  const connections = useOAuthConnections();
  const repositories = useRepositories();
  const scans = useScans();
  const complete = useCompleteOnboarding();

  const status = onboarding.data;
  const hasConnection = (connections.data ?? []).length > 0;
  const hasRepository = (repositories.data ?? []).length > 0;
  const hasCompletedScan = (scans.data ?? []).some((scan) => scan.status === 'completed');
  const hasFindings = hasCompletedScan;

  const stateFor = React.useMemo(() => {
    return {
      connect_provider: hasConnection || Boolean(status?.steps.connect_provider?.done),
      add_repository: hasRepository || Boolean(status?.steps.add_repository?.done),
      run_first_scan: hasCompletedScan || Boolean(status?.steps.run_first_scan?.done),
      read_finding: hasFindings,
    } as Record<string, boolean>;
  }, [hasConnection, hasRepository, hasCompletedScan, hasFindings, status]);

  const doneCount = STEPS.filter((step) => stateFor[step.key]).length;
  const allDone = doneCount === STEPS.length;

  return (
    <AppPage>
      <PageHeader
        title="Set up your workspace"
        description="Four steps from an empty workspace to a finding you can read. Each one is a real record the API keeps, so progress survives a refresh."
        actions={
          allDone ? (
            <Button
              size="sm"
              variant="primary"
              loading={complete.isPending}
              onClick={async () => {
                try {
                  await complete.mutateAsync();
                  toast.success('Setup marked complete');
                } catch {
                  toast.error('The completion could not be recorded.');
                }
              }}
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              Mark setup complete
            </Button>
          ) : undefined
        }
      />

      {onboarding.isError ? (
        <ErrorState
          title="Could not read onboarding status"
          body="The status endpoint did not answer. The individual steps still work from their own pages."
          onRetry={() => void onboarding.refetch()}
        />
      ) : null}

      {onboarding.isLoading ? <LoadingRegion label="Loading setup status" /> : null}

      {status ? (
        <>
          <Panel>
            <PanelHeader
              title={`${doneCount} of ${STEPS.length} steps done`}
              hint={
                status.completed && status.completed_at
                  ? `Setup was marked complete ${relativeTime(status.completed_at)}.`
                  : 'Setup completion is a record, not a gate: every page works without it.'
              }
            />
            <div className="px-5 py-5 sm:px-6">
              <ol className="space-y-0">
                {STEPS.map((step, index) => {
                  const done = stateFor[step.key];
                  const Icon = step.icon;
                  const last = index === STEPS.length - 1;
                  return (
                    <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={
                            done
                              ? 'grid size-8 shrink-0 place-items-center rounded-md border border-verified-line bg-verified-soft text-verified'
                              : 'grid size-8 shrink-0 place-items-center rounded-md border border-hairline bg-card text-muted'
                          }
                        >
                          {done ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : (
                            <Icon className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        {!last ? <span className="mt-1 w-px flex-1 bg-hairline" aria-hidden="true" /> : null}
                      </div>

                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="text-[14.5px] font-medium text-ink">{step.title}</h2>
                          {done ? (
                            <span className="chip border-verified-line bg-verified-soft text-verified">
                              Done
                            </span>
                          ) : (
                            <span className="chip">
                              <CircleDashed className="size-3" aria-hidden="true" />
                              Open
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-body">
                          {step.body}
                        </p>
                        <div className="mt-3">
                          <Button asChild size="sm" variant={done ? 'ghost' : 'secondary'}>
                            <Link href={step.href}>{step.action}</Link>
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Panel>

          {!hasRepository ? (
            <Callout tone="accent" title="Start with the repository you know best">
              The first scan is most useful on code you can judge yourself. Once you have read one
              finding end to end, the rest of the list is much faster to triage.
            </Callout>
          ) : null}
        </>
      ) : null}

      {!onboarding.isLoading && !status ? (
        <EmptyState
          title="Setup status is unavailable"
          body="The onboarding endpoint returned nothing for this account. You can still import a repository and start a scan directly."
          action={
            <Button asChild size="sm" variant="primary">
              <Link href="/repositories/new">Import a repository</Link>
            </Button>
          }
        />
      ) : null}
    </AppPage>
  );
}
