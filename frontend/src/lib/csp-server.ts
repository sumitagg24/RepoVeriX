import { headers } from 'next/headers';

/**
 * Read the per-request CSP nonce set by src/middleware.ts. Server components
 * only — client components never need it (React attaches the nonce when the
 * server renders the tag).
 *
 * Returns undefined when middleware did not run (static asset requests),
 * letting callers render un-nonced scripts that only matter in dev.
 */
export function getNonce(): string | undefined {
  return headers().get('x-nonce') ?? undefined;
}
