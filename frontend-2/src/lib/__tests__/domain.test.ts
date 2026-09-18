import {
  PLAN_CATALOG,
  PLAN_ORDER,
  asSeverity,
  isSeverity,
  planFromInfo,
  repositoryStatusTone,
  usageRatio,
} from '@/lib/domain';
import type { PlanInfo } from '@/types/api';

describe('severity mapping', () => {
  it('accepts every backend severity literal', () => {
    for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
      expect(isSeverity(severity)).toBe(true);
      expect(asSeverity(severity)).toBe(severity);
    }
  });

  it('falls back to info for unknown values instead of throwing', () => {
    expect(isSeverity('catastrophic')).toBe(false);
    expect(asSeverity('catastrophic')).toBe('info');
    expect(asSeverity(undefined)).toBe('info');
    expect(asSeverity(42)).toBe('info');
  });
});

describe('plan facts', () => {
  it('mirrors the backend PLANS table', () => {
    // These numbers come from backend/app/services/billing.py; a mismatch here
    // means marketing and enforcement have drifted apart.
    expect(PLAN_CATALOG.free.priceMonthly).toBe(0);
    expect(PLAN_CATALOG.free.limits.scansPerMonth).toBe(5);
    expect(PLAN_CATALOG.pro.priceMonthly).toBe(29);
    expect(PLAN_CATALOG.pro.limits.maxRepositories).toBe(20);
    expect(PLAN_CATALOG.team.priceMonthly).toBe(99);
    expect(PLAN_CATALOG.team.limits.maxRepositories).toBe(100);
    expect(PLAN_ORDER).toEqual(['free', 'pro', 'team']);
  });

  it('escalates capability flags monotonically', () => {
    expect(PLAN_CATALOG.free.limits.llmEnabled).toBe(false);
    expect(PLAN_CATALOG.pro.limits.llmEnabled).toBe(true);
    expect(PLAN_CATALOG.team.limits.sandboxEnabled).toBe(true);
    expect(PLAN_CATALOG.team.limits.scansPerMonth).toBeGreaterThan(
      PLAN_CATALOG.pro.limits.scansPerMonth
    );
  });

  it('resolves live plan info back to display facts', () => {
    const info: PlanInfo = {
      name: 'pro',
      display_name: 'Pro',
      price_monthly: 29,
      max_repositories: 20,
      scans_per_month: 60,
      fixes_per_month: 30,
      verifications_per_month: 30,
      website_audits_per_month: 100,
      llm_enabled: true,
      sandbox_enabled: true,
      collaborators: 1,
    };
    expect(planFromInfo(info).displayName).toBe('Pro');
  });
});

describe('usageRatio', () => {
  it('clamps at one and returns null for unusable limits', () => {
    expect(usageRatio(5, 10)).toBe(0.5);
    expect(usageRatio(30, 10)).toBe(1);
    expect(usageRatio(0, 0)).toBeNull();
    expect(usageRatio(1, Number.NaN)).toBeNull();
  });
});

describe('repositoryStatusTone', () => {
  it('maps ingest states to distinct tones', () => {
    expect(repositoryStatusTone('ready')).toBe('verified');
    expect(repositoryStatusTone('ingesting')).toBe('primary');
    expect(repositoryStatusTone('failed')).toBe('critical');
    expect(repositoryStatusTone('unexpected-value')).toBe('neutral');
  });
});
