'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useCompleteOnboarding, useOnboardingStatus } from '@/hooks/useOnboarding';
import type { OnboardingStepKey } from '@/types/api';
import { CheckCircle2, Circle, FolderGit2, ScanSearch, X, Link2 } from 'lucide-react';
import { toneHue } from '@/lib/tone';

const STEP_ORDER: OnboardingStepKey[] = ['connect_provider', 'add_repository', 'run_first_scan'];

const STEP_LABEL: Record<OnboardingStepKey, string> = {
  connect_provider: 'Connect GitHub or GitLab',
  add_repository: 'Add your first repository',
  run_first_scan: 'Run your first scan',
};

/** "Getting started" card shown until onboarding is completed (or skipped). */
export function OnboardingChecklistCard() {
  const { user } = useAuth();
  const { data: status } = useOnboardingStatus({ enabled: Boolean(user) });
  const complete = useCompleteOnboarding();

  if (!user || !status || status.completed) return null;

  const doneCount = STEP_ORDER.filter((k) => status.steps[k]?.done).length;
  const hrefFor = (key: OnboardingStepKey): string => {
    if (key === 'add_repository') return '/repositories/new';
    if (key === 'run_first_scan') {
      return status.latest_repository ? `/repositories/${status.latest_repository.id}` : '/repositories';
    }
    return '/onboarding';
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Getting started</h2>
            <span className="text-xs text-muted-foreground">
              {doneCount} of {STEP_ORDER.length} complete
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild className="h-7 gap-1.5 rounded-lg text-xs text-muted-foreground">
              <Link href="/onboarding">
                <Link2 className="h-3.5 w-3.5" /> Open onboarding
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hide the getting started checklist"
              title="Don't show again"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              disabled={complete.isPending}
              onClick={() => complete.mutate()}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ul className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {STEP_ORDER.map((key) => {
            const done = status.steps[key]?.done;
            const Icon = key === 'run_first_scan' ? ScanSearch : FolderGit2;
            return (
              <li key={key}>
                <Link
                  href={hrefFor(key)}
                  className={
                    done
                      ? 'flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground'
                      : 'group flex items-center gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5'
                  }
                >
                  {done ? (
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${toneHue('verified')}`} aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  )}
                  <span className="truncate">{done ? status.steps[key].detail || STEP_LABEL[key] : STEP_LABEL[key]}</span>
                  {!done && <Icon className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-primary" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
