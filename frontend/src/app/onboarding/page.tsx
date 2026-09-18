'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { OAuthSignInButton } from '@/components/oauth-buttons';
import { useAuth } from '@/context/AuthContext';
import { useCompleteOnboarding, useOnboardingStatus } from '@/hooks/useOnboarding';
import { ONBOARDING_CONNECT_FLAG } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { toneHue, toneSurface } from '@/lib/tone';
import {
  ArrowRight,
  CheckCircle2,
  FolderGit2,
  Loader2,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';

const STEP_ORDER = ['connect_provider', 'add_repository', 'run_first_scan'] as const;

export default function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const enabled = Boolean(user);
  const { data: status, isLoading } = useOnboardingStatus({ enabled });
  const complete = useCompleteOnboarding();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  const steps = status?.steps;
  const allDone = Boolean(steps && STEP_ORDER.every((k) => steps[k]?.done));

  // Everything genuinely done -> record completion without waiting for a click.
  useEffect(() => {
    if (allDone && status && !status.completed && !complete.isPending) {
      complete.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, status?.completed]);

  // Follow the first incomplete step as progress happens.
  useEffect(() => {
    if (!steps) return;
    const nextIdx = STEP_ORDER.findIndex((k) => !steps[k]?.done);
    if (nextIdx === -1) return;
    setActive(nextIdx);
  }, [steps?.connect_provider.done, steps?.add_repository.done, steps?.run_first_scan.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => {
    complete.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['onboarding'] });
        router.push('/dashboard');
      },
    });
  };

  if (authLoading || !user || (enabled && isLoading && !status)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading onboarding" />
      </div>
    );
  }

  if (allDone) {
    return (
      <Shell>
        <Card className="w-full max-w-md border-primary/20 shadow-lg shadow-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className={cn('flex h-14 w-14 items-center justify-center rounded-full', toneSurface('verified'))}>
              <ShieldCheck className={cn('h-7 w-7', toneHue('verified'))} aria-hidden />
            </span>
            <h1 className="type-page-title">Your workspace is ready</h1>
            <p className="text-sm text-muted-foreground">
              You connected a source, added a repository and ran your first scan. From here,
              every finding you see is backed by evidence — and every fix is verified by execution.
            </p>
            <Button asChild className="mt-2 w-full">
              <Link href="/dashboard">
                Go to dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const currentKey = STEP_ORDER[Math.min(active, STEP_ORDER.length - 1)];

  return (
    <Shell>
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="type-page-title">
            Welcome, {user.full_name.split(' ')[0]}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Three quick steps and your first audit is underway.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* step rail */}
          <nav aria-label="Onboarding steps" className="space-y-1.5">
            {STEP_ORDER.map((key, idx) => {
              const done = Boolean(steps?.[key]?.done);
              const isActive = idx === active;
              const meta = STEP_META[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(idx)}
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    isActive
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  {done ? (
                    <CheckCircle2 className={cn('h-4.5 w-4.5 shrink-0', toneHue('verified'))} aria-hidden />
                  ) : (
                    <span
                      className={cn(
                        'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium',
                        isActive ? 'border-primary text-primary' : 'border-border'
                      )}
                      aria-hidden
                    >
                      {idx + 1}
                    </span>
                  )}
                  <span className={cn(done && 'text-muted-foreground line-through decoration-border')}>
                    {meta.title}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* step content */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              {currentKey === 'connect_provider' && (
                <StepFrame
                  icon={<FolderGit2 className="h-5 w-5" aria-hidden />}
                  title="Connect a source"
                  body="Link GitHub or GitLab so RepoVeriX can clone the repositories you grant access to. Tokens are stored encrypted-at-rest and are only used to read code for analysis."
                >
                  {steps?.connect_provider.done ? (
                    <ConnectedNote detail={steps.connect_provider.detail} />
                  ) : (
                    <div className="space-y-2.5">
                      <OAuthSignInButton
                        provider="github"
                        next="/onboarding"
                        onRedirect={() => sessionStorage.setItem(ONBOARDING_CONNECT_FLAG, '1')}
                      />
                      <OAuthSignInButton
                        provider="gitlab"
                        next="/onboarding"
                        onRedirect={() => sessionStorage.setItem(ONBOARDING_CONNECT_FLAG, '1')}
                      />
                      <p className="pt-1 text-xs text-muted-foreground">
                        Optional for now — you can also add repositories by URL in the next step.
                      </p>
                    </div>
                  )}
                </StepFrame>
              )}

              {currentKey === 'add_repository' && (
                <StepFrame
                  icon={<FolderGit2 className="h-5 w-5" aria-hidden />}
                  title="Add your first repository"
                  body="Import from a connected provider, clone by URL, or upload an archive. Every repository gets its own isolated working copy — your code is analyzed, never executed."
                >
                  {steps?.add_repository.done ? (
                    <ConnectedNote detail={steps.add_repository.detail} />
                  ) : (
                    <Button asChild className="w-full sm:w-auto">
                      <Link href="/repositories/new">
                        Add a repository
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </StepFrame>
              )}

              {currentKey === 'run_first_scan' && (
                <StepFrame
                  icon={<ScanSearch className="h-5 w-5" aria-hidden />}
                  title="Run your first scan"
                  body="A scan walks your codebase: symbols, imports, call graphs, dependencies. Findings come back with evidence chains, and anything the AI claims is validated against the repository before you see it."
                >
                  {status?.latest_repository ? (
                    <Button asChild className="w-full sm:w-auto">
                      <Link href={`/repositories/${status.latest_repository.id}`}>
                        Scan {status.latest_repository.name}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full sm:w-auto">
                      <Link href="/repositories">
                        Go to repositories
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </StepFrame>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={skip}
            disabled={complete.isPending}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Skip for now — you can finish this anytime from the dashboard
          </button>
        </div>
      </div>
    </Shell>
  );
}

const STEP_META: Record<(typeof STEP_ORDER)[number], { title: string }> = {
  connect_provider: { title: 'Connect a source' },
  add_repository: { title: 'Add a repository' },
  run_first_scan: { title: 'Run a scan' },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="fixed left-4 top-4 z-50 flex items-center gap-2">
        <LogoMark className="h-8 w-8" />
        <span className="text-sm font-semibold tracking-tight">RepoVeriX</span>
      </div>
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle variant="solid" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.08),transparent)]"
      />
      <div className="relative flex w-full justify-center">{children}</div>
    </div>
  );
}

function StepFrame({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ConnectedNote({ detail }: { detail?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="chip state-verified-soft">
        {detail || 'Done'}
      </span>
      <span className="text-xs text-muted-foreground">Completed</span>
    </div>
  );
}
