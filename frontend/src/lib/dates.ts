import { format, formatDistanceToNowStrict, isValid } from 'date-fns';

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return isValid(date) ? date : null;
}

/** "3 minutes ago". Missing or invalid timestamps read as "None" rather
 *  than a dash, because a lone dash is ambiguous to a screen reader. */
export function relativeTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return 'None';
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** "18 Sep 2026, 14:02" — absolute, unambiguous, locale-aware. */
export function absoluteTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return 'None';
  return format(date, 'd MMM yyyy, HH:mm');
}

/** "18 Sep 2026" */
export function absoluteDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'd MMM yyyy');
}

/** "14:02:33" — used in scan timelines and audit logs. */
export function timeOfDay(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'HH:mm:ss');
}

/** Duration between two timestamps as "1m 12s" (running scans pass `null` end). */
export function duration(start: string | null, end: string | null): string {
  const from = toDate(start);
  if (!from) return 'None';
  const to = toDate(end) ?? new Date();
  const seconds = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Chart-friendly axis label. */
export function axisDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return format(date, 'd MMM');
}

/** Age in whole days — used for "finding age" summaries. */
export function ageInDays(value: string | Date | null | undefined): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}
