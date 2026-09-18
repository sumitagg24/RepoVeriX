'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Minus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStartCheckout } from '@/hooks/use-platform';
import { useAuth } from '@/context/auth-context';
import { ALWAYS_INCLUDED, LIMIT_GROUPS, PLANS, PLAN_ORDER, formatPrice, type PlanFacts } from '@/lib/plans';
import { cn } from '@/lib/utils';

const BILLING_NOTE =
  'Prices are per month in US dollars and billed monthly. Usage counters reset at the end of each billing period.';

/**
 * Plans.
 *
 * One bordered comparison rather than three floating towers: the three plans are
 * columns of the same surface, separated by hairlines, with the recommended plan
 * tinted instead of enlarged. All limits come from the catalogue that mirrors the
 * backend, so the public page cannot drift from what the API enforces.
 */
function PlanColumn({
  plan,
  currentPlan,
  busy,
  onChoose,
  signedIn,
}: {
  plan: PlanFacts;
  currentPlan: string | null;
  busy: boolean;
  onChoose: (plan: PlanFacts) => void;
  signedIn: boolean;
}) {
  const isCurrent = currentPlan === plan.name;

  return (
    <div
      className={cn(
        'flex flex-col gap-5 px-5 py-6 sm:px-6',
        plan.recommended && 'bg-surface/70',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{plan.displayName}</h3>
        {plan.recommended ? <Badge tone="accent">Best fit for small teams</Badge> : null}
        {isCurrent ? <Badge tone="verified">Current plan</Badge> : null}
      </div>

      <div>
        <p className="flex items-baseline gap-1.5">
          <span data-numeric className="text-[34px] font-semibold leading-none tracking-tight text-ink">
            {formatPrice(plan.priceMonthly)}
          </span>
          <span className="text-[13px] text-muted">/ month</span>
        </p>
        <p className="mt-3 min-h-16 text-[13.5px] leading-relaxed text-body">{plan.audience}</p>
      </div>

      <Button
        variant={plan.recommended ? 'primary' : 'secondary'}
        size="lg"
        className="w-full"
        loading={busy}
        onClick={() => onChoose(plan)}
      >
        {isCurrent ? 'Manage plan' : plan.name === 'free' ? 'Start free' : `Choose ${plan.displayName}`}
      </Button>

      <dl className="space-y-3 border-t border-hairline pt-5">
        {[
          { label: 'Repositories', value: `${plan.maxRepositories}` },
          { label: 'Scans per month', value: `${plan.scansPerMonth}` },
          { label: 'Model reasoning', value: plan.llmEnabled ? 'Included' : 'Not included' },
          {
            label: 'Sandboxed verification',
            value: plan.sandboxEnabled ? 'Included' : 'Not included',
          },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-muted">{row.label}</dt>
            <dd
              data-numeric
              className={cn(
                'text-[13px]',
                row.value === 'Not included' ? 'text-faint' : 'font-medium text-ink',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {!signedIn ? (
        <p className="text-[12.5px] leading-relaxed text-faint">
          {plan.name === 'free'
            ? 'No card required. Deterministic analysis runs without any provider key.'
            : 'Checkout is handled by the API. Cancel from the billing screen at any time.'}
        </p>
      ) : null}
    </div>
  );
}

export function PricingPlans({ showLimits = true }: { showLimits?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const checkout = useStartCheckout();
  const [pendingPlan, setPendingPlan] = React.useState<string | null>(null);

  const choose = async (plan: PlanFacts) => {
    if (!user) {
      router.push(`/auth/sign-up?plan=${plan.name}`);
      return;
    }
    if (plan.name === 'free') {
      router.push('/billing');
      return;
    }
    setPendingPlan(plan.name);
    try {
      const result = await checkout.mutateAsync(plan.name);
      // Demo deployments return a URL on this app; live Stripe returns its own.
      window.location.href = result.url;
    } catch (error) {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error('Could not start checkout', {
        description:
          typeof message === 'string'
            ? message
            : 'The billing endpoint refused the request. The reason is recorded in the API response.',
      });
      setPendingPlan(null);
    }
  };

  return (
    <div>
      <div className="panel grid grid-cols-1 divide-y divide-hairline overflow-hidden lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {PLAN_ORDER.map((name) => (
          <PlanColumn
            key={name}
            plan={PLANS[name]}
            currentPlan={user?.plan ?? null}
            busy={pendingPlan === name}
            onChoose={choose}
            signedIn={Boolean(user)}
          />
        ))}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{BILLING_NOTE}</p>

      {showLimits ? (
        <div className="mt-14">
          <h3 className="text-[17px] font-semibold tracking-tight text-ink">
            Where the plans actually differ
          </h3>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-body">
            Three groups, because that is how the difference reads in practice: how much you can point
            the product at, what reasoning and repair it can do, and what you can hand to someone else.
          </p>

          <div className="mt-6 space-y-8">
            {LIMIT_GROUPS.map((group) => (
              <div key={group.title}>
                <h4 className="text-[13px] font-medium text-muted">{group.title}</h4>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
                    <caption className="sr-only">{group.title} by plan</caption>
                    <thead>
                      <tr className="border-b border-hairline">
                        <th scope="col" className="py-2.5 pr-4 text-[12px] font-medium text-muted">
                          Limit
                        </th>
                        {PLAN_ORDER.map((name) => (
                          <th
                            key={name}
                            scope="col"
                            className="py-2.5 pr-4 text-[12px] font-medium text-muted"
                          >
                            {PLANS[name].displayName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {group.rows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row" className="py-3 pr-4 text-left font-normal text-ink">
                            {row.label}
                          </th>
                          {PLAN_ORDER.map((name) => {
                            const value = row.value(PLANS[name]);
                            const excluded = value === 'Not included';
                            return (
                              <td key={name} className="py-3 pr-4 text-body">
                                <span className="flex items-center gap-2">
                                  {excluded ? (
                                    <Minus className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                                  ) : (
                                    <Check className="size-3.5 shrink-0 text-verified" aria-hidden="true" />
                                  )}
                                  {value}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-hairline pt-6">
            <h4 className="text-[13px] font-medium text-muted">Included on every plan</h4>
            <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
              {ALWAYS_INCLUDED.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-body">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-verified" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Compact plan summary used as a section on the home page. */
export function PricingSummary() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {PLAN_ORDER.map((name) => {
        const plan = PLANS[name];
        return (
          <div key={name} className="border-t border-hairline pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[14px] font-medium text-ink">{plan.displayName}</h3>
              <span data-numeric className="font-mono text-[13px] text-muted">
                {formatPrice(plan.priceMonthly)}
                {plan.priceMonthly > 0 ? '/mo' : ''}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-body">
              {plan.maxRepositories} repositories, {plan.scansPerMonth} scans per month
              {plan.llmEnabled ? ', model reasoning and sandboxed verification' : ', deterministic analysis only'}.
            </p>
          </div>
        );
      })}
      <p className="text-[13px] text-muted sm:col-span-3">
        Full limit comparison on the{' '}
        <Link href="/pricing" className="text-accent underline-offset-4 hover:underline">
          pricing page
        </Link>
        .
      </p>
    </div>
  );
}
