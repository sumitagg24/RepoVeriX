'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, CreditCard, Info, Minus } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, PlanBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState, LoadingRegion, SkeletonText } from '@/components/ui/states';
import { useAuth } from '@/context/auth-context';
import { useBilling, useOpenBillingPortal, useStartCheckout } from '@/hooks/use-platform';
import { LIMIT_GROUPS, PLANS, PLAN_ORDER, formatPrice } from '@/lib/plans';
import { absoluteTime } from '@/lib/dates';
import { toApiFailure } from '@/services/api';

/**
 * Plan and usage.
 *
 * Every number on this page comes from `GET /billing`, which is the authoritative
 * catalogue for an account. The published limits are shown beside it so a person
 * can compare before switching, and the upgrade action posts to the same checkout
 * endpoint the backend already exposes. When the deployment runs without a
 * payment provider, checkout answers with `demo: true` and the page says so
 * instead of sending anyone to a URL that does not exist.
 */
export default function BillingPage() {
  const { user } = useAuth();
  const billing = useBilling();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();

  const plan = billing.data?.plan;
  const planFacts = plan ? PLANS[plan.name] : PLANS.free;

  const startCheckout = async (target: 'free' | 'pro' | 'team') => {
    try {
      const result = await checkout.mutateAsync(target);
      if (result.demo) {
        toast.info('This deployment runs without a payment provider, so checkout is in demo mode.');
        return;
      }
      window.location.href = result.url;
    } catch (error) {
      toast.error(toApiFailure(error).message);
    }
  };

  const openPortal = async () => {
    try {
      const result = await portal.mutateAsync();
      window.location.href = result.url;
    } catch (error) {
      toast.error(toApiFailure(error).message);
    }
  };

  return (
    <AppPage>
      <PageHeader
        title="Billing"
        description="Your plan, what it entitles you to, and how much of it this period has used. Limits are enforced by the API, so this page shows the same numbers the API does."
        actions={
          billing.data ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void billing.refetch()}
                loading={billing.isFetching}
              >
                Refresh
              </Button>
              {billing.data.subscription.stripe_customer_id ? (
                <Button size="sm" variant="primary" loading={portal.isPending} onClick={() => void openPortal()}>
                  <CreditCard className="size-3.5" aria-hidden="true" />
                  Billing portal
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

      {billing.isError ? (
        <ErrorState
          title="Could not load billing"
          body="The billing endpoint did not answer. Plan limits are still enforced server-side."
          onRetry={() => void billing.refetch()}
        />
      ) : null}

      {billing.isLoading ? (
        <LoadingRegion label="Loading plan and usage">
          <SkeletonText lines={4} />
        </LoadingRegion>
      ) : null}

      {billing.data && plan ? (
        <>
          {billing.data.demo_mode ? (
            <Callout tone="info" title="This deployment has no payment provider configured">
              Plan changes are recorded without a charge. Every limit below is still enforced, which
              is why the usage numbers matter even in demo mode.
            </Callout>
          ) : null}

          <Panel>
            <PanelHeader
              title="Current plan"
              hint={`Signed in as ${user?.email ?? 'this account'}.`}
              icon={<CreditCard className="size-4" />}
              actions={<PlanBadge plan={plan.name} />}
            />
            <div className="grid grid-cols-1 gap-6 px-5 py-5 sm:px-6 lg:grid-cols-3">
              <div>
                <p className="text-[13px] text-muted">Price</p>
                <p data-numeric className="mt-1 text-[24px] font-semibold leading-none text-ink">
                  {formatPrice(plan.price_monthly)}
                  <span className="text-[13px] font-normal text-muted"> per month</span>
                </p>
              </div>
              <div>
                <p className="text-[13px] text-muted">Subscription</p>
                <p className="mt-1 text-[14px] text-ink">
                  {billing.data.subscription.status ?? 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-muted">Period ends</p>
                <p className="mt-1 text-[14px] text-ink">
                  {absoluteTime(billing.data.subscription.period_end ?? billing.data.usage.period_ends_at)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Usage this period"
              hint="Counted by the API. A request beyond a limit is refused with the reason, never silently dropped."
            />
            <div className="grid grid-cols-1 gap-6 px-5 py-5 sm:px-6 lg:grid-cols-2">
              <ProgressBar
                label="Repositories"
                value={billing.data.usage.repositories}
                max={plan.max_repositories}
              />
              <ProgressBar
                label="Scans"
                value={billing.data.usage.scans_used}
                max={plan.scans_per_month}
              />
              <ProgressBar
                label="Generated fixes"
                value={billing.data.usage.fixes_used}
                max={plan.fixes_per_month}
              />
              <ProgressBar
                label="Verification runs"
                value={billing.data.usage.verifications_used}
                max={plan.verifications_per_month}
              />
            </div>
          </Panel>

          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Compare plans</h2>
            <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-relaxed text-body">
              Published limits for every plan. The numbers above are the live ones for this account;
              these are what each plan includes if you switch.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {PLAN_ORDER.map((name) => {
                const facts = PLANS[name];
                const current = name === plan.name;
                const upgrade = PLAN_ORDER.indexOf(name) > PLAN_ORDER.indexOf(plan.name);
                return (
                  <Panel key={name} className={current ? 'border-accent-line' : undefined}>
                    <div className="flex flex-col gap-4 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[15px] font-semibold text-ink">{facts.displayName}</h3>
                        <div className="flex items-center gap-2">
                          {facts.recommended && !current ? <Badge tone="accent">Most teams</Badge> : null}
                          {current ? <Badge tone="verified">Current</Badge> : null}
                        </div>
                      </div>

                      <p data-numeric className="text-[28px] font-semibold leading-none tracking-tight text-ink">
                        {formatPrice(facts.priceMonthly)}
                        <span className="text-[13px] font-normal text-muted"> per month</span>
                      </p>

                      <p className="text-[13px] leading-relaxed text-body">{facts.audience}</p>

                      <ul className="space-y-2 border-t border-hairline pt-4">
                        <PlanLine on label={`${facts.maxRepositories} repositories`} />
                        <PlanLine on label={`${facts.scansPerMonth} scans per month`} />
                        <PlanLine on label={`${facts.fixesPerMonth} generated fixes per month`} />
                        <PlanLine on label={`${facts.verificationsPerMonth} verification runs per month`} />
                        <PlanLine
                          on={facts.llmEnabled}
                          label={facts.llmEnabled ? 'Model reasoning included' : 'Model reasoning'}
                        />
                        <PlanLine
                          on={facts.sandboxEnabled}
                          label={facts.sandboxEnabled ? 'Sandbox verification included' : 'Sandbox verification'}
                        />
                        <PlanLine
                          on={facts.collaborators > 1}
                          label={
                            facts.collaborators > 1
                              ? `${facts.collaborators} collaborators`
                              : 'Single account'
                          }
                        />
                      </ul>

                      <div className="mt-auto pt-2">
                        {current ? (
                          <Button size="sm" variant="secondary" disabled className="w-full justify-center">
                            Your current plan
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={upgrade ? 'primary' : 'secondary'}
                            className="w-full justify-center"
                            loading={checkout.isPending && checkout.variables === name}
                            onClick={() => void startCheckout(name)}
                          >
                            {upgrade ? 'Upgrade' : 'Switch plan'}
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>

          <Panel>
            <PanelHeader
              title="What each limit covers"
              hint="The exact counters the API enforces, grouped the way the product uses them."
              icon={<Info className="size-4" />}
            />
            <div className="grid grid-cols-1 gap-6 px-5 py-5 sm:px-6 lg:grid-cols-3">
              {LIMIT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-[13.5px] font-medium text-ink">{group.title}</h3>
                  <dl className="mt-2.5 divide-y divide-hairline border-t border-hairline">
                    {group.rows.map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
                        <dt className="text-[13px] leading-relaxed text-body">{row.label}</dt>
                        <dd className="shrink-0 font-mono text-[12.5px] text-ink">
                          {row.value(planFacts)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : null}

      {!billing.isLoading && !billing.data && !billing.isError ? (
        <EmptyState
          title="No plan information available"
          body="The billing endpoint returned nothing for this account. Signing out and back in re-issues the session token, which is what the endpoint authenticates with."
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard">Back to overview</Link>
            </Button>
          }
        />
      ) : null}
    </AppPage>
  );
}

function PlanLine({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-relaxed">
      {on ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-verified" aria-hidden="true" />
      ) : (
        <Minus className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden="true" />
      )}
      <span className={on ? 'text-body' : 'text-muted'}>{label}</span>
      <span className="sr-only">{on ? 'included' : 'not included'}</span>
    </li>
  );
}
