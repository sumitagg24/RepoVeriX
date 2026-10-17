import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Accept a `next` value only when it is a plain path on this origin.
 *
 * `next` arrives from the URL on the sign-in and OAuth callback pages, so it
 * is attacker-controllable. A value like `//evil.example` or
 * `https://evil.example` would turn those pages into an open redirect, and a
 * `javascript:` URL is worse. Anything that is not a single-slash absolute
 * path is discarded rather than repaired — a wrong destination is preferable
 * to an unsafe one.
 */
export function safeRedirectPath(
  path: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!path) return fallback;
  const value = path.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  if (value.includes('\\') || /[\r\n\0]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, 'https://repoverix.invalid');
    if (parsed.origin !== 'https://repoverix.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
