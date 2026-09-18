'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBilling, useCheckout, usePortal } from '@/hooks/useBilling';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PlanTable } from '@/components/marketing/plan-table';
import type { PlanName } from '@/types/api';

function UsageBar({
  used,
  limit,
  label,
  hint,
}: {
  used: number;
  limit: number;
  label: string;
  hint: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const isNearLimit = pct >= 85;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className={cn('text-xs tabular-nums text-muted-foreground', isNearLimit && 'font-semibold text-amber-600 dark:text-amber-400')}>
          {used} / {limit} <span className="text-[11px] text-muted-foreground/70 font-normal">({hint})</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isNearLimit ? 'bg-amber-500' : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BillingPageInner() {
  const searchParams = useSearchParams();
  const { data, isLoading } = useBilling();
  const checkout = useCheckout();
  const portal = usePortal();

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (searchParams.get('checkout') === 'success') {
      toast.success(`Upgraded to ${plan ? plan[0].toUpperCase() + plan.slice(1) : 'Pro'} — welcome aboard!`);
    }
  }, [searchParams]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="h-64 animate-pulse rounded-lg bg-muted/40" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { plan, usage, subscription, demo_mode } = data;

  const handleSelectPlan = (planName: PlanName) => {
    checkout.mutate(planName);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Plans &amp; Billing
            </h1>
            <Badge variant="outline" className="capitalize bg-primary/5 text-primary border-primary/20">
              {plan.display_name}
            </Badge>
            {demo_mode && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                Demo Mode
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your subscription tier, usage quotas, and billing settings.
          </p>
        </div>

        {plan.name !== 'free' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
            className="shadow-sm"
          >
            {portal.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Customer Portal
          </Button>
        )}
      </div>

      {/* Current plan usage overview */}
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CreditCard className="h-4 w-4 text-primary" />
              Monthly Quotas &amp; Usage
            </h2>
            <p className="text-xs text-muted-foreground">
              Current cycle resets on{' '}
              <span className="font-medium text-foreground">
                {new Date(usage.period_ends_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active Subscription
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <UsageBar used={usage.repositories} limit={plan.max_repositories} label="Repositories" hint="active repos" />
          <UsageBar used={usage.scans_used} limit={plan.scans_per_month} label="Scans" hint="monthly quota" />
          <UsageBar used={usage.fixes_used} limit={plan.fixes_per_month} label="AI Automated Fixes" hint="monthly quota" />
          <UsageBar
            used={usage.verifications_used}
            limit={plan.verifications_per_month}
            label="Verified Sandbox Repairs"
            hint="monthly quota"
          />
          <UsageBar
            used={usage.website_audits_used}
            limit={plan.website_audits_per_month}
            label="Website Security Audits"
            hint="monthly quota"
          />
        </div>
      </div>

      {/* Plan selection cards */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Available Tiers</h2>
          <p className="text-sm text-muted-foreground">
            Upgrade anytime to expand repository limits, unlock deeper LLM analysis, and scale automated verifications.
          </p>
        </div>
        <PlanTable
          currentPlan={plan.name}
          onSelectPlan={handleSelectPlan}
          checkoutPendingPlan={checkout.isPending ? (checkout.variables ?? null) : null}
        />
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
        Need custom enterprise seats, dedicated sandboxes, or on-premise runner deployment?{' '}
        <Link href="/help/contact" className="font-semibold text-primary hover:underline">
          Talk to Enterprise Sales
        </Link>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="h-64 animate-pulse rounded bg-muted/50" />
              </Card>
            ))}
          </div>
        </div>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}
