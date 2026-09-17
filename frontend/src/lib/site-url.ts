/**
 * Canonical public origin of the frontend, used for metadata (metadataBase,
 * canonical URLs, OpenGraph) and by middleware for the CSP connect/img
 * sources. Import from here — route modules (layout.tsx etc.) must not export
 * arbitrary consts: Next.js type-checks their export surface strictly.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
