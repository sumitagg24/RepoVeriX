import {
  isSeverity,
  asSeverity,
  SEVERITY_LABEL,
  SEVERITY_RANK,
  FINDING_STATUS_LABEL,
  CONFIDENCE_LABEL,
  VERIFICATION_LABEL,
  TONE_STYLES,
} from '../domain';

describe('Domain mapping and enums', () => {
  it('correctly identifies severity strings', () => {
    expect(isSeverity('critical')).toBe(true);
    expect(isSeverity('high')).toBe(true);
    expect(isSeverity('unknown_severity')).toBe(false);
    expect(asSeverity('invalid')).toBe('info');
    expect(asSeverity('medium')).toBe('medium');
  });

  it('ranks severities in correct priority order', () => {
    expect(SEVERITY_RANK.critical).toBeLessThan(SEVERITY_RANK.high);
    expect(SEVERITY_RANK.high).toBeLessThan(SEVERITY_RANK.medium);
    expect(SEVERITY_RANK.medium).toBeLessThan(SEVERITY_RANK.low);
  });

  it('provides complete display labels', () => {
    expect(SEVERITY_LABEL.critical).toBe('Critical');
    expect(FINDING_STATUS_LABEL.verified).toBe('Verified');
    expect(CONFIDENCE_LABEL(0.924)).toBe('92% confidence');
    expect(VERIFICATION_LABEL.verified_repair).toBe('Verified repair');
  });

  it('defines valid tone styles', () => {
    expect(TONE_STYLES.critical.badge).toContain('critical');
    expect(TONE_STYLES.verified.badge).toContain('verified');
  });
});
