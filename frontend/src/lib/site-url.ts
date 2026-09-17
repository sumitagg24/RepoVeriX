/**
 * Canonical public origin of the frontend, used for metadata (metadataBase,
 * canonical URLs, OpenGraph) and by middleware for the CSP connect/img
 * sources. Import from here — route modules (layout.tsx etc.) must not export
 * arbitrary consts: Next.js type-checks their export surface strictly.
 *
 * Precedence: explicit `NEXT_PUBLIC_SITE_URL` (self-hosters, previews) →
 * Vercel's automatic `VERCEL_URL` (always present on Vercel builds) →
 * localhost (local dev only). Never ship localhost metadata to production.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim().length > 0) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim().length > 0) return `https://${vercel.replace(/\/+$/, '')}`;
  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();
