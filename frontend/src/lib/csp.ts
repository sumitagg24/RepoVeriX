/**
 * Content-Security-Policy builder for RepoVeriX.
 *
 * Pure function, unit-tested in src/lib/__tests__/csp.test.ts, consumed by
 * src/middleware.ts which generates the per-request nonce.
 *
 * Policy design:
 *  - `script-src` is strict: `'nonce-…' 'strict-dynamic'`. Next.js detects the
 *    CSP request header set by middleware and nonces its own bootstrap/chunk
 *    scripts; app-owned inline scripts (theme bootstrap, JSON-LD) read the
 *    nonce via `x-nonce`. No `'unsafe-inline'`, no script host allowlist.
 *  - `style-src 'self' 'unsafe-inline'`: React renders dynamic `style`
 *    attributes (progress bars, gauges) which CSP cannot nonce. Style
 *    injection does not execute, so this is the accepted trade-off.
 *  - `connect-src`: the browser calls the FastAPI backend directly via
 *    NEXT_PUBLIC_API_URL (axios baseURL), plus the same-origin proxy.
 *  - Dev adds `'unsafe-eval'` (react-refresh) and ws:/wss: (HMR).
 *  - `upgrade-insecure-requests` only in production (it would interfere with
 *    plain-http localhost calls in dev).
 */

export interface CspOptions {
  environment: 'development' | 'production';
  /** Base64 nonce for inline <script> blocks (without the 'nonce-' prefix). */
  nonce: string;
  /** Backend origin the browser calls directly (NEXT_PUBLIC_API_URL). */
  apiUrl?: string;
  /** Frontend origin (NEXT_PUBLIC_SITE_URL); allowed in connect/img sources. */
  siteUrl?: string;
  /** Emit as Content-Security-Policy-Report-Only (rollout canary). */
  reportOnly?: boolean;
  /** Optional violation report collector URL. */
  reportUri?: string;
}

const AVATAR_HOSTS = [
  'https://avatars.githubusercontent.com',
  'https://gitlab.com',
  'https://secure.gravatar.com',
];

function normalizeOrigin(raw: string | undefined): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Bare host like "api.example.com" — assume https.
  return `https://${trimmed}`;
}

export function buildCsp(opts: CspOptions): { header: string; value: string; reportOnly: boolean } {
  const api = normalizeOrigin(opts.apiUrl);
  const site = normalizeOrigin(opts.siteUrl);
  const dev = opts.environment === 'development';

  const connectSources = Array.from(new Set(["'self'", api, site].filter(Boolean)));
  if (dev) connectSources.push('ws:', 'wss:');
  const imgSources = Array.from(new Set(["'self'", 'data:', ...AVATAR_HOSTS]));

  const scriptSources = [`'nonce-${opts.nonce}'`, `'strict-dynamic'`];
  if (dev) scriptSources.push(`'unsafe-eval'`);

  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSources.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!dev) directives.push('upgrade-insecure-requests');
  if (opts.reportUri) directives.push(`report-uri ${opts.reportUri}`);

  return {
    header: opts.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    value: directives.join('; '),
    reportOnly: Boolean(opts.reportOnly),
  };
}
