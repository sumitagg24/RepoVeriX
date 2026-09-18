import {
  decisionTone,
  qualityTone,
  reachabilityTone,
  regressionTone,
  riskTone,
  scanTone,
  scoreTone,
  severityTone,
  smellTone,
  sourceTone,
  toneBar,
  toneBorder,
  toneChip,
  toneHue,
  toneInk,
  toneRing,
  toneSoft,
  toneSolid,
  toneSurface,
  trendTone,
  verdictTone,
} from '@/lib/tone';

/**
 * These tests exist because `lib/tone.ts` is the one place that decides what a
 * severity, verdict, trend or risk score *looks* like. Everything downstream —
 * badges, bars, borders, icons — reads those class strings. A wrong mapping
 * here would repaint the whole product at once, so the mappings are pinned.
 *
 * They also guard the property the old per-page palettes broke: every face must
 * name a CSS custom property (`hsl(var(--…))`) or a hand-written token class.
 * No face may hardcode a colour value.
 */

describe('tone faces always resolve through a token', () => {
  const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
  const states = [
    'verified',
    'probable',
    'rejected',
    'observed',
    'recommendation',
    'insufficient',
  ] as const;

  it('names the token class for severity tones', () => {
    for (const tone of severities) {
      expect(toneSolid(tone)).toBe(`sev-${tone}`);
      expect(toneSoft(tone)).toBe(`sev-${tone}-soft`);
      expect(toneChip(tone)).toBe(`chip sev-${tone}-soft`);
      expect(toneChip(tone, 'lg')).toBe(`chip chip-lg sev-${tone}-soft`);
    }
  });

  it('names the token class for verdict tones', () => {
    for (const tone of states) {
      expect(toneSolid(tone)).toBe(`state-${tone}`);
      expect(toneSoft(tone)).toBe(`state-${tone}-soft`);
    }
  });

  it('never emits a literal colour for ink, hue, surface, border, bar or ring', () => {
    const faces = [...severities, ...states, 'neutral'] as const;
    for (const tone of faces) {
      for (const cls of [
        toneInk(tone),
        toneHue(tone),
        toneSurface(tone),
        toneBorder(tone),
        toneBar(tone),
        toneRing(tone),
      ]) {
        expect(cls).not.toMatch(/#[0-9a-f]{3,8}/i);
        expect(cls).not.toMatch(/-\d{3}\b/); // no bg-red-500-style palette step
      }
    }
  });

  it('falls back to the muted scale for the neutral tone', () => {
    expect(toneSolid('neutral')).toBe('chip-outline');
    expect(toneSoft('neutral')).toBe('chip-outline');
    expect(toneInk('neutral')).toBe('text-muted-foreground');
    expect(toneBar('neutral')).toBe('bg-muted-foreground/50');
  });
});

describe('severity and verdict mapping', () => {
  it('coerces severity, defaulting unknown values to info', () => {
    expect(severityTone('CRITICAL')).toBe('critical');
    expect(severityTone('nonsense')).toBe('info');
    expect(severityTone(null)).toBe('info');
  });

  it('keeps finding verdicts and website states in one vocabulary', () => {
    expect(verdictTone('verified')).toBe('verified');
    expect(verdictTone('rejected')).toBe('rejected');
    expect(verdictTone('observed')).toBe('observed');
    expect(verdictTone('recommendation')).toBe('recommendation');
  });

  it('maps every proof-of-fix decision, and never leaves one invisible', () => {
    expect(decisionTone('VERIFIED_FIX')).toBe('verified');
    expect(decisionTone('VERIFIED_FIX_PROOF')).toBe('verified');
    expect(decisionTone('PARTIALLY_VERIFIED')).toBe('probable');
    expect(decisionTone('REJECTED_FIX')).toBe('critical');
    expect(decisionTone('REPAIR_FAILED')).toBe('critical');
    expect(decisionTone('UNVERIFIABLE')).toBe('neutral');
    expect(decisionTone(null)).toBe('neutral');
  });
});

describe('lifecycle and quality mapping', () => {
  it('treats a failed scan as critical rather than neutral', () => {
    expect(scanTone('completed')).toBe('verified');
    expect(scanTone('running')).toBe('observed');
    expect(scanTone('pending')).toBe('probable');
    expect(scanTone('failed')).toBe('critical');
    expect(scanTone('cancelled')).toBe('neutral');
  });

  it('grades patch quality', () => {
    expect(qualityTone('excellent')).toBe('verified');
    expect(qualityTone('good')).toBe('verified');
    expect(qualityTone('fair')).toBe('probable');
    expect(qualityTone('poor')).toBe('critical');
  });

  it('labels a regression kind without borrowing a severity it does not have', () => {
    expect(regressionTone('new')).toBe('critical');
    expect(regressionTone('resolved')).toBe('verified');
    expect(regressionTone('still_present')).toBe('probable');
    expect(regressionTone('reintroduced')).toBe('critical');
    expect(regressionTone('severity_changed')).toBe('recommendation');
  });

  it('reads reachability as urgency, not as safety', () => {
    expect(reachabilityTone('directly_reachable')).toBe('critical');
    expect(reachabilityTone('indirectly_reachable')).toBe('high');
    expect(reachabilityTone('unreachable')).toBe('verified');
    expect(reachabilityTone('UNKNOWN')).toBe('neutral');
  });

  it('ranks architecture smells and detection sources', () => {
    expect(smellTone('god_module')).toBe('critical');
    expect(smellTone('dependency_cycle')).toBe('critical');
    expect(smellTone('hub_module')).toBe('high');
    expect(smellTone('unstable_module')).toBe('medium');
    expect(sourceTone('static')).toBe('observed');
    expect(sourceTone('llm')).toBe('recommendation');
    expect(sourceTone('hybrid')).toBe('verified');
  });
});

describe('numeric mappings', () => {
  it('treats a rising number as good only when asked', () => {
    expect(trendTone(-4)).toBe('verified'); // fewer findings
    expect(trendTone(4)).toBe('critical');
    expect(trendTone(4, true)).toBe('verified'); // higher score
    expect(trendTone(-4, true)).toBe('critical');
    expect(trendTone(0)).toBe('neutral');
    expect(trendTone(null)).toBe('neutral');
  });

  it('bands a 0-100 analytical score', () => {
    expect(scoreTone(90)).toBe('verified');
    expect(scoreTone(60)).toBe('probable');
    expect(scoreTone(10)).toBe('critical');
    expect(scoreTone(null)).toBe('neutral');
  });

  it('bands risk on whichever scale the endpoint returned', () => {
    // 0-100 (change audit)
    expect(riskTone(80)).toBe('critical');
    expect(riskTone(60)).toBe('high');
    expect(riskTone(30)).toBe('medium');
    expect(riskTone(5)).toBe('low');
    // 0-10 (file health, overall risk)
    expect(riskTone(8, 10)).toBe('critical');
    expect(riskTone(6, 10)).toBe('high');
    expect(riskTone(3, 10)).toBe('medium');
    expect(riskTone(1, 10)).toBe('low');
    // 0-1 (predicted risk)
    expect(riskTone(0.9, 1)).toBe('critical');
    expect(riskTone(0.2, 1)).toBe('low');
    // The same digit string is not the same risk on two scales — this is the
    // bug the shared mapping exists to prevent.
    expect(riskTone(8, 10)).toBe('critical');
    expect(riskTone(8, 100)).toBe('low');
    expect(riskTone(8)).toBe('low'); // 0-100 is the default scale
  });

  it('refuses to band missing or nonsensical input', () => {
    expect(riskTone(null)).toBe('neutral');
    expect(riskTone(Number.NaN)).toBe('neutral');
    expect(riskTone(50, 0 as never)).toBe('neutral');
    expect(riskTone(-10)).toBe('low');
    expect(riskTone(1000)).toBe('critical');
  });
});
