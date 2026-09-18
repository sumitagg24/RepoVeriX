import type { PlanName } from '@/types/api';

/**
 * Single source of truth for plan facts in the frontend.
 *
 * !!! These numbers MIRROR `backend/app/services/billing.py` (the PLANS map).
 * The server is what actually enforces them; this module exists so marketing
 * pages, the pricing table and the billing screen cannot disagree.
 *
 * Why this file exists: the homepage previously advertised Team as "Custom" /
 * "Unlimited scans" / "Contact sales" while the server enforced $99/mo and
 * 400 scans per month (and exposed a real Stripe price id for it). Someone
 * reading the marketing page was being told something false about the product.
 *
 * When a limit changes in the backend, change it here in the same commit.
 */

export interface PlanFacts {
  name: PlanName;
  displayName: string;
  /** USD per month. Mirrors `price_monthly / 100` in the backend PLANS map. */
  priceMonthly: number;
  blurb: string;
  /** Numeric entitlements — see the backend PLANS map. */
  limits: {
    maxRepositories: number;
    scansPerMonth: number;
    fixesPerMonth: number;
    verificationsPerMonth: number;
    websiteAuditsPerMonth: number;
    collaborators: number;
    llmEnabled: boolean;
    sandboxEnabled: boolean;
  };
  /** Feature lines shown on pricing surfaces. Wording mirrors the backend
   *  `highlights` tuples so the two lists read the same. */
  highlights: string[];
  cta: { label: string; href: string };
  /** Marks the recommended tier on pricing surfaces. */
  popular?: boolean;
}

export const PLAN_CATALOG: Record<PlanName, PlanFacts> = {
  free: {
    name: 'free',
    displayName: 'Free',
    priceMonthly: 0,
    blurb: 'Try RepoVeriX on a small repository — no card required.',
    limits: {
      maxRepositories: 3,
      scansPerMonth: 5,
      fixesPerMonth: 2,
      verificationsPerMonth: 2,
      websiteAuditsPerMonth: 10,
      collaborators: 1,
      llmEnabled: false,
      sandboxEnabled: false,
    },
    highlights: [
      '3 repositories',
      '5 scans / month',
      '10 website audits / month',
      'Static + hybrid findings',
      '2 candidate fixes',
      '2 sandbox verifications',
    ],
    cta: { label: 'Start free', href: '/auth/signup' },
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceMonthly: 29,
    blurb: 'For developers who audit code every week.',
    limits: {
      maxRepositories: 20,
      scansPerMonth: 60,
      fixesPerMonth: 30,
      verificationsPerMonth: 30,
      websiteAuditsPerMonth: 100,
      collaborators: 1,
      llmEnabled: true,
      sandboxEnabled: true,
    },
    highlights: [
      '20 repositories',
      '60 scans / month',
      '100 website audits / month',
      'LLM reasoning included',
      'Unlimited findings & evidence',
      'Sandboxed verified repairs',
      'PDF / Markdown reports',
    ],
    cta: { label: 'Start free', href: '/auth/signup' },
    popular: true,
  },
  team: {
    name: 'team',
    displayName: 'Team',
    priceMonthly: 99,
    blurb: 'For teams shipping and reviewing together.',
    limits: {
      maxRepositories: 100,
      scansPerMonth: 400,
      fixesPerMonth: 200,
      verificationsPerMonth: 200,
      websiteAuditsPerMonth: 500,
      collaborators: 5,
      llmEnabled: true,
      sandboxEnabled: true,
    },
    highlights: [
      '100 repositories',
      '400 scans / month',
      '500 website audits / month',
      '5 collaborators',
      'Priority queue & support',
      'Audit history & reports',
      'Everything in Pro',
    ],
    cta: { label: 'Start free', href: '/auth/signup' },
  },
};

/** Display order on pricing surfaces (cheapest → most capable). */
export const PLAN_ORDER: PlanName[] = ['free', 'pro', 'team'];

export function getPlanFacts(plan: PlanName): PlanFacts {
  return PLAN_CATALOG[plan];
}

/** "$0" | "$29" | "$99" — never a bare number without a currency mark. */
export function formatPlanPrice(plan: PlanFacts): string {
  return `$${plan.priceMonthly}`;
}

/**
 * One-line quota summary for dense tables and footnotes, e.g.
 * "3 repos · 5 scans/mo · 10 site audits/mo".
 */
export function planQuotaLine(plan: PlanFacts): string {
  const { limits } = plan;
  return [
    `${limits.maxRepositories} repos`,
    `${limits.scansPerMonth} scans/mo`,
    `${limits.websiteAuditsPerMonth} site audits/mo`,
  ].join(' · ');
}
