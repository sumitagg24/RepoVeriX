/**
 * RepoVeriX design-system primitives — the single source of truth for
 * severity / status / verdict styling.
 *
 * Every badge, chip, bar and pipeline step that communicates severity,
 * confidence or verification state MUST use these maps instead of ad-hoc
 * `bg-*-500/10` strings. One definition → consistent meaning everywhere,
 * light and dark.
 */

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type SeverityLevel = (typeof SEVERITY_ORDER)[number];

/** Outline chip: severity badge on cards, rows, headers. */
export const SEVERITY_CHIP: Record<string, string> = {
  critical: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  high: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  medium: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  info: 'border-border bg-muted text-muted-foreground',
};

/** Solid bar fill for distribution meters. */
export const SEVERITY_BAR: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
  info: 'bg-muted-foreground/50',
};

/** Finding validation status: verified = evidence-backed, probable = needs
 *  confirmation, rejected = refuted. Never communicate status by color alone —
 *  labels always accompany the chip. */
export const STATUS_CHIP: Record<string, string> = {
  verified: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  probable: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rejected: 'border-border bg-muted text-muted-foreground',
};

/** Scan lifecycle status. */
export const SCAN_CHIP: Record<string, string> = {
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  running: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  failed: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
};

/** Proof-of-fix verdicts. Every decision the backend can return is styled —
 *  including VERIFIED_FIX_PROOF. Fallbacks render neutral, never invisible. */
export const DECISION_CHIP: Record<string, string> = {
  VERIFIED_FIX: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  VERIFIED_FIX_PROOF: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  PARTIALLY_VERIFIED: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  REJECTED_FIX: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  UNVERIFIABLE: 'border-border bg-muted text-muted-foreground',
};

/** Human-readable verdict labels for the final verification result. */
export const DECISION_LABEL: Record<string, string> = {
  VERIFIED_FIX: 'Verified fix',
  VERIFIED_FIX_PROOF: 'Verified fix',
  PARTIALLY_VERIFIED: 'Partially verified',
  REJECTED_FIX: 'Rejected fix',
  UNVERIFIABLE: 'Unverifiable',
};

/** Detection source. */
export const SOURCE_CHIP: Record<string, string> = {
  static: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  llm: 'border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400',
  hybrid: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

/** Patch quality grades. */
export const QUALITY_CHIP: Record<string, string> = {
  excellent: 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400',
  good: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  fair: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  poor: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
};

/**
 * Format a confidence value as a percentage.
 * The API returns 0–1; tolerate already-percent values so a wrong call site
 * can never render "0%".
 */
export function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(0)}%`;
}

/** Short human duration: "45s", "3m 12s", "2h 5m". Never "0 min". */
export function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return 'Not started';
  if (!finishedAt) return 'Running…';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return '—';
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    const secs = Math.round((ms % 60_000) / 1000);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
