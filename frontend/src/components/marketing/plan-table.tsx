import Link from 'next/link';
import { Check, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PLAN_CATALOG, PLAN_ORDER, formatPlanPrice, planQuotaLine } from '@/lib/plans';
import type { PlanName } from '@/types/api';

/**
 * PlanTable — the pricing surface, rendered from `lib/plans.ts`.
 *
 * Serves both public marketing (with signup links) and authenticated billing
 * (with interactive checkout mutation triggers).
 */
export function PlanTable({
  currentPlan,
  className,
  showFootnote = true,
  onSelectPlan,
  checkoutPendingPlan,
}: {
  /** Marks a plan as current (authenticated billing surfaces). */
  currentPlan?: PlanName;
  className?: string;
  showFootnote?: boolean;
  /** If provided, buttons trigger checkout instead of navigating to signup */
  onSelectPlan?: (planName: PlanName) => void;
  checkoutPendingPlan?: string | null;
}) {
  const plans = PLAN_ORDER.map((key) => PLAN_CATALOG[key]);

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const isPending = checkoutPendingPlan === plan.name;

          return (
            <div
              key={plan.name}
              className={cn(
                'relative flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md',
                plan.popular && !isCurrent
                  ? 'border-primary/50 ring-1 ring-primary/20 shadow-primary/5'
                  : 'border-border/80',
                isCurrent && 'border-primary/60 bg-primary/[0.02] ring-2 ring-primary/30'
              )}
            >
              {plan.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold tracking-wide text-primary-foreground shadow-sm">
                    <Zap className="h-3 w-3 fill-current" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">{plan.displayName}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    Current plan
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-foreground tabular-nums sm:text-4xl">
                  {formatPlanPrice(plan)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.priceMonthly === 0 ? 'forever' : '/ month'}
                </span>
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{plan.blurb}</p>

              <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs font-medium text-foreground/80">
                {planQuotaLine(plan)}
              </div>

              <div className="my-5 border-t border-border/60" />

              <ul className="flex-1 space-y-2.5 text-sm">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {highlight}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <Button variant="outline" className="w-full font-medium" disabled>
                    Current plan
                  </Button>
                ) : onSelectPlan ? (
                  <Button
                    variant={plan.popular ? 'default' : 'outline'}
                    className="w-full font-medium shadow-sm transition-all"
                    onClick={() => onSelectPlan(plan.name)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      plan.priceMonthly === 0 ? 'Downgrade' : `Upgrade to ${plan.displayName}`
                    )}
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant={plan.popular ? 'default' : 'outline'}
                    className="w-full font-medium shadow-sm transition-all"
                  >
                    <Link href={plan.cta.href}>{plan.cta.label}</Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showFootnote && (
        <p className="text-center text-xs text-muted-foreground">
          Prices in USD. Quotas are enforced transparently by the API — all features unlock immediately upon subscription.
        </p>
      )}
    </div>
  );
}
