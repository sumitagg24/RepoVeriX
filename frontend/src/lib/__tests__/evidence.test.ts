import {
  asFindingState,
  asSeverity,
  asWebsiteState,
  FINDING_STATE_LABELS,
  SCORE_BAND_LABELS,
  scoreBand,
  SEVERITY_LABELS,
  WEBSITE_STATE_LABELS,
} from '@/lib/evidence';

describe('severity coercion', () => {
  it('accepts the canonical scale', () => {
    expect(asSeverity('critical')).toBe('critical');
    expect(asSeverity('HIGH')).toBe('high');
  });

  it('falls back to info for unknown values', () => {
    expect(asSeverity('catastrophic')).toBe('info');
    expect(asSeverity(null)).toBe('info');
    expect(asSeverity(undefined)).toBe('info');
  });
});

describe('finding state coercion', () => {
  it('maps the repository state model', () => {
    expect(asFindingState('verified')).toBe('verified');
    expect(asFindingState('REJECTED')).toBe('rejected');
    expect(asFindingState('weird')).toBe('probable');
    expect(asFindingState('')).toBe('probable');
  });

  it('exposes uppercase-ready labels for every state', () => {
    expect(Object.keys(FINDING_STATE_LABELS)).toHaveLength(3);
    expect(SEVERITY_LABELS).toHaveProperty('critical', 'Critical');
  });
});

describe('website state coercion', () => {
  it('maps repository states onto website states honestly', () => {
    expect(asWebsiteState('verified')).toBe('observed');
    expect(asWebsiteState('observed')).toBe('observed');
    expect(asWebsiteState('probable')).toBe('recommendation');
    expect(asWebsiteState('anything-else')).toBe('insufficient');
  });

  it('labels all three website states', () => {
    expect(WEBSITE_STATE_LABELS).toHaveProperty('insufficient', 'Insufficient evidence');
  });
});

describe('score bands', () => {
  it('bands the analytical scale honestly', () => {
    expect(scoreBand(90)).toBe('strong');
    expect(scoreBand(80)).toBe('strong');
    expect(scoreBand(79.9)).toBe('moderate');
    expect(scoreBand(55)).toBe('moderate');
    expect(scoreBand(54)).toBe('weak');
    expect(scoreBand(0)).toBe('weak');
  });

  it('refuses to band missing data', () => {
    expect(scoreBand(null)).toBe('unknown');
    expect(scoreBand(undefined)).toBe('unknown');
    expect(scoreBand(Number.NaN)).toBe('unknown');
    expect(SCORE_BAND_LABELS.unknown).toBe('Insufficient data');
  });
});
