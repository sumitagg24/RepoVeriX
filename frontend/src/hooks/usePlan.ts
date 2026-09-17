'use client';

import { useBilling } from '@/hooks/useBilling';

export type PlanName = 'free' | 'pro' | 'team';

/**
 * The current user's plan entitlements, derived from the billing overview.
 * While billing is still loading the user is treated as Free (the safest
 * assumption) so no premium tool is ever shown as unlocked by mistake.
 */
export function usePlan() {
  const { data, isLoading, refetch } = useBilling();
  const ready = !isLoading && Boolean(data);
  const planName: PlanName = (data?.plan?.name as PlanName) ?? 'free';
  return {
    planName,
    isFree: planName === 'free',
    llmEnabled: Boolean(data?.plan?.llm_enabled),
    sandboxEnabled: Boolean(data?.plan?.sandbox_enabled),
    plan: data?.plan,
    usage: data?.usage,
    /** True once the plan is known; gates anything that depends on it. */
    ready,
    refetch,
  };
}

/** Scan configurations that run the full LLM pipeline (Pro-only). */
export const LLM_LEAD_CONFIGS = new Set(['repoverix', 'llm_only']);
