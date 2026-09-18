/**
 * Tone — the single bridge between a domain value and the RVX token layer.
 *
 * Why this file exists: pages were hand-writing `bg-red-500/10 text-red-600
 * dark:text-red-400 border-red-500/20` (and four near-identical variants of it)
 * for every severity, verdict, health trend, regression kind and smell. That is
 * a parallel colour system: it ignores `--sev-*` / `--state-*` / `--band-*`
 * completely, so the light theme could not retune it, the four-face contrast
 * work did not apply, and two screens could mean different things by the same
 * hue.
 *
 * Every class below is built from tokens that already exist in `globals.css`.
 * No new colour value is introduced here, and none should be: add the token
 * first (in both `.light` and `.dark`), then map to it.
 *
 * The four faces, per the token layer:
 *   solid  `.sev-critical`              filled chip / bar fill
 *   soft   `.sev-critical-soft`         tinted surface (the dense-row default)
 *   ink    `--sev-critical-ink`         text on the soft surface
 *   hue    `--sev-critical`             the hue itself — icons, figures, borders
 *
 * IMPLEMENTATION NOTE — why the `FACES` map is written out longhand:
 * `.sev-*` and `.state-*` are hand-written rules in `globals.css`, so they
 * always exist and can be interpolated safely. The remaining faces are Tailwind
 * *arbitrary values* (`text-[hsl(var(--sev-critical-ink))]`), and Tailwind
 * discovers those by scanning source text. An interpolated candidate such as
 * `text-[hsl(var(${prefix}-${tone}-ink))]` never appears literally in any file,
 * so the utility would never be generated and the styles would silently vanish.
 * Writing them out keeps the classes discoverable, greppable and correct.
 */

import { asFindingState, asSeverity, asWebsiteState, scoreBand, type ScoreBand } from '@/lib/evidence';

/** Every semantic tone the product can express. */
export type Tone =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info'
  | 'verified'
  | 'probable'
  | 'rejected'
  | 'observed'
  | 'recommendation'
  | 'insufficient'
  | 'neutral';

const SEVERITY_TONES = ['critical', 'high', 'medium', 'low', 'info'] as const;
const STATE_TONES = [
  'verified',
  'probable',
  'rejected',
  'observed',
  'recommendation',
  'insufficient',
] as const;

type TokenPrefix = '--sev' | '--state';

/** Which token family a tone reads from; null for the neutral (muted) tone. */
function tokenPrefix(tone: Tone): TokenPrefix | null {
  if ((SEVERITY_TONES as readonly string[]).includes(tone)) return '--sev';
  if ((STATE_TONES as readonly string[]).includes(tone)) return '--state';
  return null;
}

/**
 * Literal arbitrary-value faces. Keys are the concrete token names in
 * globals.css — keep this in sync when a token family is added.
 */
type LiteralFace = {
  ink: string;
  hue: string;
  surface: string;
  border: string;
  bar: string;
  ring: string;
};

const FACES: Record<string, LiteralFace> = {
  '--sev-critical': {
    ink: 'text-[hsl(var(--sev-critical-ink))]',
    hue: 'text-[hsl(var(--sev-critical))]',
    surface: 'bg-[hsl(var(--sev-critical-soft))]',
    border: 'border-[hsl(var(--sev-critical)/0.35)]',
    bar: 'bg-[hsl(var(--sev-critical))]',
    ring: 'ring-[hsl(var(--sev-critical)/0.25)]',
  },
  '--sev-high': {
    ink: 'text-[hsl(var(--sev-high-ink))]',
    hue: 'text-[hsl(var(--sev-high))]',
    surface: 'bg-[hsl(var(--sev-high-soft))]',
    border: 'border-[hsl(var(--sev-high)/0.35)]',
    bar: 'bg-[hsl(var(--sev-high))]',
    ring: 'ring-[hsl(var(--sev-high)/0.25)]',
  },
  '--sev-medium': {
    ink: 'text-[hsl(var(--sev-medium-ink))]',
    hue: 'text-[hsl(var(--sev-medium))]',
    surface: 'bg-[hsl(var(--sev-medium-soft))]',
    border: 'border-[hsl(var(--sev-medium)/0.35)]',
    bar: 'bg-[hsl(var(--sev-medium))]',
    ring: 'ring-[hsl(var(--sev-medium)/0.25)]',
  },
  '--sev-low': {
    ink: 'text-[hsl(var(--sev-low-ink))]',
    hue: 'text-[hsl(var(--sev-low))]',
    surface: 'bg-[hsl(var(--sev-low-soft))]',
    border: 'border-[hsl(var(--sev-low)/0.35)]',
    bar: 'bg-[hsl(var(--sev-low))]',
    ring: 'ring-[hsl(var(--sev-low)/0.25)]',
  },
  '--sev-info': {
    ink: 'text-[hsl(var(--sev-info-ink))]',
    hue: 'text-[hsl(var(--sev-info))]',
    surface: 'bg-[hsl(var(--sev-info-soft))]',
    border: 'border-[hsl(var(--sev-info)/0.35)]',
    bar: 'bg-[hsl(var(--sev-info))]',
    ring: 'ring-[hsl(var(--sev-info)/0.25)]',
  },
  '--state-verified': {
    ink: 'text-[hsl(var(--state-verified-ink))]',
    hue: 'text-[hsl(var(--state-verified))]',
    surface: 'bg-[hsl(var(--state-verified-soft))]',
    border: 'border-[hsl(var(--state-verified)/0.35)]',
    bar: 'bg-[hsl(var(--state-verified))]',
    ring: 'ring-[hsl(var(--state-verified)/0.25)]',
  },
  '--state-probable': {
    ink: 'text-[hsl(var(--state-probable-ink))]',
    hue: 'text-[hsl(var(--state-probable))]',
    surface: 'bg-[hsl(var(--state-probable-soft))]',
    border: 'border-[hsl(var(--state-probable)/0.35)]',
    bar: 'bg-[hsl(var(--state-probable))]',
    ring: 'ring-[hsl(var(--state-probable)/0.25)]',
  },
  '--state-rejected': {
    ink: 'text-[hsl(var(--state-rejected-ink))]',
    hue: 'text-[hsl(var(--state-rejected))]',
    surface: 'bg-[hsl(var(--state-rejected-soft))]',
    border: 'border-[hsl(var(--state-rejected)/0.35)]',
    bar: 'bg-[hsl(var(--state-rejected))]',
    ring: 'ring-[hsl(var(--state-rejected)/0.25)]',
  },
  '--state-observed': {
    ink: 'text-[hsl(var(--state-observed-ink))]',
    hue: 'text-[hsl(var(--state-observed))]',
    surface: 'bg-[hsl(var(--state-observed-soft))]',
    border: 'border-[hsl(var(--state-observed)/0.35)]',
    bar: 'bg-[hsl(var(--state-observed))]',
    ring: 'ring-[hsl(var(--state-observed)/0.25)]',
  },
  '--state-recommendation': {
    ink: 'text-[hsl(var(--state-recommendation-ink))]',
    hue: 'text-[hsl(var(--state-recommendation))]',
    surface: 'bg-[hsl(var(--state-recommendation-soft))]',
    border: 'border-[hsl(var(--state-recommendation)/0.35)]',
    bar: 'bg-[hsl(var(--state-recommendation))]',
    ring: 'ring-[hsl(var(--state-recommendation)/0.25)]',
  },
  '--state-insufficient': {
    ink: 'text-[hsl(var(--state-insufficient-ink))]',
    hue: 'text-[hsl(var(--state-insufficient))]',
    surface: 'bg-[hsl(var(--state-insufficient-soft))]',
    border: 'border-[hsl(var(--state-insufficient)/0.35)]',
    bar: 'bg-[hsl(var(--state-insufficient))]',
    ring: 'ring-[hsl(var(--state-insufficient)/0.25)]',
  },
};

/** The neutral tone has no hue of its own; it reads the muted scale. */
const NEUTRAL_FACE: LiteralFace = {
  ink: 'text-muted-foreground',
  hue: 'text-muted-foreground',
  surface: 'bg-muted',
  border: 'border-border',
  bar: 'bg-muted-foreground/50',
  ring: 'ring-border',
};

function faceFor(tone: Tone): LiteralFace {
  const prefix = tokenPrefix(tone);
  return (prefix && FACES[`${prefix}-${tone}`]) || NEUTRAL_FACE;
}

/* ------------------------------------------------------------------ faces */

/** `sev-critical` / `state-verified` — the filled face. */
export function toneSolid(tone: Tone): string {
  return tokenPrefix(tone) ? `${tokenPrefix(tone)!.replace('--', '')}-${tone}` : 'chip-outline';
}

/** Tinted face — the default for dense rows and inline status. */
export function toneSoft(tone: Tone): string {
  return tokenPrefix(tone) ? `${toneSolid(tone)}-soft` : 'chip-outline';
}

/** Full soft chip: geometry + tinted face, ready to drop into a row. */
export function toneChip(tone: Tone, size: 'sm' | 'lg' = 'sm'): string {
  return `chip${size === 'lg' ? ' chip-lg' : ''} ${toneSoft(tone)}`;
}

/** Text colour tuned for the soft surface (AA on both themes). */
export function toneInk(tone: Tone): string {
  return faceFor(tone).ink;
}

/** The raw hue — for icons, figures and thin rules rather than body text. */
export function toneHue(tone: Tone): string {
  return faceFor(tone).hue;
}

/** Tinted surface without chip geometry (panels, inline code, callouts). */
export function toneSurface(tone: Tone): string {
  return faceFor(tone).surface;
}

/** Hairline border at the tone's hue. */
export function toneBorder(tone: Tone): string {
  return faceFor(tone).border;
}

/** Solid bar fill for meters and distribution segments. */
export function toneBar(tone: Tone): string {
  return faceFor(tone).bar;
}

/** Callout = tinted surface + matching hairline. */
export function toneCallout(tone: Tone): string {
  return `${toneSurface(tone)} ${toneBorder(tone)}`;
}

/** Ring at the tone's hue — for the "current row" / focus emphasis. */
export function toneRing(tone: Tone): string {
  return faceFor(tone).ring;
}

/* ------------------------------------------------------------- score bands */

/** `.band-strong` etc. — hand-written in globals.css, safe to interpolate. */
export function bandInk(band: ScoreBand): string {
  return `band-${band}`;
}

const BAND_BARS: Record<ScoreBand, string> = {
  strong: 'bg-[hsl(var(--band-strong))]',
  moderate: 'bg-[hsl(var(--band-moderate))]',
  weak: 'bg-[hsl(var(--band-weak))]',
  unknown: 'bg-[hsl(var(--band-unknown))]',
};

export function bandBar(band: ScoreBand): string {
  return BAND_BARS[band];
}

/* ------------------------------------------------------- domain → tone maps */

/**
 * Severity. Unknown values coerce to `info` via `asSeverity`, so a malformed
 * API payload renders neutral rather than failing.
 */
export function severityTone(value: string | null | undefined): Tone {
  return asSeverity(value);
}

/**
 * Finding verdict (verified / probable / rejected) and website audit state
 * (observed / recommendation / insufficient) share one vocabulary.
 */
export function verdictTone(value: string | null | undefined): Tone {
  const key = (value ?? '').toLowerCase();
  if (key === 'verified' || key === 'probable' || key === 'rejected') {
    return asFindingState(key);
  }
  return asWebsiteState(key);
}

/** Proof-of-Fix decisions. Every backend decision maps; nothing renders invisible. */
export function decisionTone(decision: string | null | undefined): Tone {
  switch ((decision ?? '').toUpperCase()) {
    case 'VERIFIED_FIX':
    case 'VERIFIED_FIX_PROOF':
    case 'VERIFIED_REPAIR':
      return 'verified';
    case 'PARTIALLY_VERIFIED':
      return 'probable';
    case 'REJECTED_FIX':
    case 'REPAIR_FAILED':
      return 'critical';
    default:
      return 'neutral';
  }
}

/** Scan lifecycle. Failure is honest — it reads as critical, not as neutral. */
export function scanTone(status: string | null | undefined): Tone {
  switch ((status ?? '').toLowerCase()) {
    case 'completed':
      return 'verified';
    case 'running':
      return 'observed';
    case 'pending':
    case 'queued':
      return 'probable';
    case 'failed':
    case 'error':
      return 'critical';
    default:
      return 'neutral';
  }
}

/** Patch quality grade. */
export function qualityTone(grade: string | null | undefined): Tone {
  switch ((grade ?? '').toLowerCase()) {
    case 'excellent':
    case 'good':
      return 'verified';
    case 'fair':
      return 'probable';
    case 'poor':
      return 'critical';
    default:
      return 'neutral';
  }
}

/**
 * Regression comparison kind. `severity_changed` has no severity of its own —
 * it is a change signal, so it maps to `recommendation` (the calm blue state
 * face) rather than borrowing a severity hue it does not have.
 */
export function regressionTone(kind: string | null | undefined): Tone {
  switch ((kind ?? '').toLowerCase()) {
    case 'new':
    case 'reintroduced':
      return 'critical';
    case 'resolved':
      return 'verified';
    case 'still_present':
      return 'probable';
    case 'severity_changed':
      return 'recommendation';
    default:
      return 'neutral';
  }
}

/** Attack-path reachability. Reachable code is the urgent signal, not the safe one. */
export function reachabilityTone(reachability: string | null | undefined): Tone {
  switch ((reachability ?? '').toLowerCase()) {
    case 'directly_reachable':
    case 'directly-reachable':
    case 'reachable':
      return 'critical';
    case 'indirectly_reachable':
    case 'indirectly-reachable':
      return 'high';
    case 'unreachable':
      return 'verified';
    default:
      return 'neutral';
  }
}

/** Architecture smell kind. */
export function smellTone(kind: string | null | undefined): Tone {
  switch ((kind ?? '').toLowerCase()) {
    case 'god_module':
    case 'dependency_cycle':
      return 'critical';
    case 'hub_module':
      return 'high';
    case 'unstable_module':
      return 'medium';
    default:
      return 'neutral';
  }
}

/** Detection source: static analysis, LLM reasoning, or both. */
export function sourceTone(source: string | null | undefined): Tone {
  switch ((source ?? '').toLowerCase()) {
    case 'static':
      return 'observed';
    case 'llm':
      return 'recommendation';
    case 'hybrid':
      return 'verified';
    default:
      return 'neutral';
  }
}

/**
 * A trend / delta direction. `goodIsUp` lets the same value mean opposite
 * things on different screens (findings up is bad; score up is good).
 */
export function trendTone(delta: number | null | undefined, goodIsUp = false): Tone {
  if (delta == null || Number.isNaN(delta) || delta === 0) return 'neutral';
  const improving = goodIsUp ? delta > 0 : delta < 0;
  return improving ? 'verified' : 'critical';
}

/**
 * A 0–100 analytical score band, expressed as a tone so a score can be chipped
 * with the same faces as severity. Uses `scoreBand` from lib/evidence.
 */
export function scoreTone(score: number | null | undefined): Tone {
  switch (scoreBand(score)) {
    case 'strong':
      return 'verified';
    case 'moderate':
      return 'probable';
    case 'weak':
      return 'critical';
    default:
      return 'neutral';
  }
}

/**
 * A risk score → tone, on whichever scale the API returned it.
 *
 * The analysis endpoints are not consistent: change-audit scores are 0–100,
 * predicted risk is 0–1, file health is 0–10. Rather than let each call site
 * re-band the thresholds (and get one of them wrong by a factor of ten), the
 * value is normalised to a fraction first and banded at 75 / 50 / 25 — the
 * thresholds the audit screen has always used.
 *
 * `low` is returned rather than `verified`: a low risk score is a severity
 * statement, not a proof of safety.
 */
export function riskTone(value: number | null | undefined, scale: 1 | 10 | 100 = 100): Tone {
  if (value == null || Number.isNaN(value) || scale <= 0) return 'neutral';
  const fraction = Math.min(1, Math.max(0, value / scale));
  if (fraction >= 0.75) return 'critical';
  if (fraction >= 0.5) return 'high';
  if (fraction >= 0.25) return 'medium';
  return 'low';
}

/** Convenience re-export so call sites need one import for band + tone work. */
export { scoreBand };
export type { ScoreBand };
