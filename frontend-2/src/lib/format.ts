export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trim a value for display, never mid-word without an ellipsis. */
export function truncate(value: string, max = 60): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Formatting.
 *
 * A missing value reads as "None" rather than as a dash: a lone dash is
 * ambiguous when a screen reader announces it, and it looks like a rendering
 * bug next to real data. Every fallback in this file says what it means.
 */

/** `13:45:02`, ISO-ish precision without locale surprises. */
export function clockTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'None';
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Group a large count: 12_480 -> "12,480". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'None';
  return new Intl.NumberFormat().format(value);
}

/** Percentage without false precision. */
export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'None';
  return `${(value * 100).toFixed(digits)}%`;
}

export function shortSha(sha: string | null | undefined, length = 8): string {
  if (!sha) return 'None';
  return sha.slice(0, length);
}

/** Basename of a repository-relative path, keeping the full path available. */
export function fileBasename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
