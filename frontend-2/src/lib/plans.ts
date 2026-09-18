/**
 * Plan catalogue.
 *
 * These values mirror the backend catalogue in `app/services/billing.py`. The
 * public pricing page needs the limits before anyone has an account, and the
 * endpoint that serves them (`GET /api/v1/billing`) requires authentication, so
 * the published limits are stated here and the authenticated billing screen
 * reads live entitlements, usage and period end from the API instead.
 *
 * Prices are integers in US cents, exactly as the API reports them.
 */
export interface PlanFacts {
  name: 'free' | 'pro' | 'team';
  displayName: string;
  priceMonthly: number;
  audience: string;
  maxRepositories: number;
  scansPerMonth: number;
  fixesPerMonth: number;
  verificationsPerMonth: number;
  websiteAuditsPerMonth: number;
  collaborators: number;
  llmEnabled: boolean;
  sandboxEnabled: boolean;
  /** The plan most teams should start on, called out without extra height. */
  recommended?: boolean;
}

export const PLAN_ORDER: PlanFacts['name'][] = ['free', 'pro', 'team'];

export const PLANS: Record<PlanFacts['name'], PlanFacts> = {
  free: {
    name: 'free',
    displayName: 'Free',
    priceMonthly: 0,
    audience: 'One repository you want to read end to end, with deterministic analysis only.',
    maxRepositories: 3,
    scansPerMonth: 5,
    fixesPerMonth: 2,
    verificationsPerMonth: 2,
    websiteAuditsPerMonth: 10,
    collaborators: 1,
    llmEnabled: false,
    sandboxEnabled: false,
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceMonthly: 2900,
    audience: 'A developer or small team scanning real projects every week.',
    maxRepositories: 20,
    scansPerMonth: 60,
    fixesPerMonth: 30,
    verificationsPerMonth: 30,
    websiteAuditsPerMonth: 100,
    collaborators: 1,
    llmEnabled: true,
    sandboxEnabled: true,
    recommended: true,
  },
  team: {
    name: 'team',
    displayName: 'Team',
    priceMonthly: 9900,
    audience: 'A security group watching many repositories and reporting on posture.',
    maxRepositories: 100,
    scansPerMonth: 400,
    fixesPerMonth: 200,
    verificationsPerMonth: 200,
    websiteAuditsPerMonth: 500,
    collaborators: 5,
    llmEnabled: true,
    sandboxEnabled: true,
  },
};

export function formatPrice(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(0)}`;
}

/** Grouped so the comparison reads as three decisions, not twelve rows. */
export const LIMIT_GROUPS = [
  {
    title: 'Scope',
    rows: [
      { label: 'Repositories', value: (plan: PlanFacts) => `${plan.maxRepositories}` },
      { label: 'Scans per month', value: (plan: PlanFacts) => `${plan.scansPerMonth}` },
      { label: 'Website audits per month', value: (plan: PlanFacts) => `${plan.websiteAuditsPerMonth}` },
      { label: 'Collaborators', value: (plan: PlanFacts) => `${plan.collaborators}` },
    ],
  },
  {
    title: 'Reasoning and repair',
    rows: [
      { label: 'Model reasoning', value: (plan: PlanFacts) => (plan.llmEnabled ? 'Included' : 'Not included') },
      {
        label: 'Candidate fixes per month',
        value: (plan: PlanFacts) => `${plan.fixesPerMonth}`,
      },
      {
        label: 'Sandboxed verifications per month',
        value: (plan: PlanFacts) => `${plan.verificationsPerMonth}`,
      },
    ],
  },
  {
    title: 'Reporting',
    rows: [
      { label: 'Evidence and findings', value: () => 'Unlimited on every plan' },
      { label: 'Exports', value: (plan: PlanFacts) => (plan.name === 'free' ? 'JSON and SARIF' : 'JSON, SARIF and Markdown') },
      { label: 'Audit history', value: (plan: PlanFacts) => (plan.name === 'team' ? 'Included' : 'Not included') },
    ],
  },
] as const;

/**
 * What every plan keeps, regardless of tier. This is the product's posture, not
 * a feature: no plan makes findings more certain than they are.
 */
export const ALWAYS_INCLUDED = [
  'Every finding states confidence, reachability and the evidence behind it',
  'A finding that fails validation is recorded as probable or rejected, not hidden',
  'No repository contents are sent to a model provider on a plan without reasoning',
  'Usage counters and period end are visible in the workspace at all times',
] as const;
