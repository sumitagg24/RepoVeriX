'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBilling, useCheckout, usePortal } from '@/hooks/useBilling';
import { Check, CreditCard, ExternalLink, Loader2, Sparkles, Zap, Building2 } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PlanName } from '@/types/api';

const PLAN_META: Record<PlanName, { icon: React.ComponentType<{ className?: string }>; name: string; blurb: string }> = {
  free: { icon: Check, name: 'Free', blurb: 'Try RepoVeriX on a small repository — no card required.' },
  pro: { icon: Sparkles, name: 'Pro', blurb: 'For developers who audit code every week.' },
  team: { icon: Building2, name: 'Team', blurb: 'For teams shipping and reviewing together.' },
};

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
  const near = pct >= 85;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('tabular-nums text-muted-foreground', near && 'font-medium text-primary')}>
          {used} / {limit} <span className="text-xs">{hint}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', near ? 'bg-primary' : 'bg-primary/50')}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/4 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="h-64 animate-pulse rounded bg-muted/60" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { plan, usage, subscription, demo_mode } = data;
  const plans: PlanName[] = ['free', 'pro', 'team'];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Plans & billing</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Audit more, pay when it matters</h1>
          <p className="mt-1 text-muted-foreground">
            You&apos;re on the <span className="font-medium text-foreground">{plan.display_name}</span> plan.
            {demo_mode && ' · demo billing is active — upgrades simulate instantly without Stripe.'}
          </p>
        </div>
        {subscription.status && subscription.status !== 'active' && subscription.status !== 'trialing' ? (
          <Badge variant="outline" className="capitalize">
            {subscription.status}
          </Badge>
        ) : (
          <Badge variant="outline" className="capitalize">
            {subscription.status ?? 'free'}
          </Badge>
        )}
      </div>

      {/* Current plan usage */}
      <Card className="animate-rise" style={{ animationDelay: '60ms' }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              This month&apos;s usage
            </CardTitle>
            <CardDescription>Resets {new Date(usage.period_ends_at).toLocaleDateString()}</CardDescription>
          </div>
          {plan.name !== 'free' && (
            <Button variant="outline" size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
              {portal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Manage subscription
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <UsageBar used={usage.repositories} limit={plan.max_repositories} label="Repositories" hint="active" />
          <UsageBar used={usage.scans_used} limit={plan.scans_per_month} label="Scans" hint="this cycle" />
          <UsageBar used={usage.fixes_used} limit={plan.fixes_per_month} label="AI fixes" hint="this cycle" />
          <UsageBar
            used={usage.verifications_used}
            limit={plan.verifications_per_month}
            label="Verified repairs"
            hint="this cycle"
          />
          <UsageBar
            used={usage.website_audits_used}
            limit={plan.website_audits_per_month}
            label="Website audits"
            hint="this cycle"
          />
        </CardContent>
      </Card>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((key, i) => {
          const meta = PLAN_META[key];
          const limits = key === 'free' ? plan : null; // plan limits come from overview only for current plan
          const isCurrent = plan.name === key;
          const price =
            key === 'free'
              ? 0
              : key === 'pro'
                ? 29
                : 99;
          const features =
            key === 'free'
              ? ['3 repositories', '5 scans / month', 'Static + hybrid findings', '2 candidate fixes', '2 sandbox verifications']
              : key === 'pro'
                ? ['20 repositories', '60 scans / month', 'LLM reasoning included', 'Unlimited findings & evidence', 'Sandboxed verified repairs', 'PDF / Markdown reports']
                : ['100 repositories', '400 scans / month', '5 collaborators', 'Priority queue & support', 'Audit history & reports', 'Everything in Pro'];
          const Icon = meta.icon;
          return (
            <Card
              key={key}
              className={cn(
                'animate-rise relative flex flex-col',
                isCurrent && 'ring-2 ring-primary/40',
                key === 'pro' && !isCurrent && 'border-primary/30'
              )}
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              {key === 'pro' && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  Most popular
                </span>
              )}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {isCurrent && <Badge>Current plan</Badge>}
                </div>
                <CardTitle className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl">{meta.name}</span>
                  <span className="text-3xl font-semibold">${price}</span>
                  <span className="text-sm font-normal text-muted-foreground">/ month</span>
                </CardTitle>
                <CardDescription>{meta.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-2 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={key === 'pro' ? 'default' : 'outline'}
                      onClick={() => checkout.mutate(key)}
                      disabled={checkout.isPending}
                    >
                      {checkout.isPending && key === (checkout.variables ?? '') ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      {key === 'free' ? 'Downgrade' : `Upgrade to ${meta.name}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prices in USD. Cancel anytime from the billing portal. Need a different setup?{' '}
        <Link href="/settings" className="font-medium text-primary hover:underline">
          Contact support
        </Link>
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-1/4 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="h-64 animate-pulse rounded bg-muted/60" />
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