import { NextResponse, type NextRequest } from 'next/server';

import { buildCsp } from '@/lib/csp';

/**
 * Per-request Content-Security-Policy with a nonce pipeline.
 *
 * Every document response gets a fresh base64 nonce. The policy is attached to
 * BOTH the request (so Next.js auto-nonces its own bootstrap/chunk scripts)
 * and the response (so the browser enforces it). App-owned inline scripts read
 * the same nonce from the `x-nonce` request header via next/headers.
 *
 * It also tags private, per-user routes with `X-Robots-Tag: noindex`.
 * robots.txt already disallows these paths, which stops crawling — but a
 * disallowed URL is never *fetched*, so a crawler could never see a noindex
 * directive placed in the HTML. The response header closes that gap for
 * crawlers that ignore robots.txt or arrive via a direct link, and stays
 * correct if the disallow rules are ever relaxed.
 *
 * Rollout canary: set REPOVERIX_CSP_REPORT_ONLY=true to emit the policy as
 * Content-Security-Policy-Report-Only instead of enforcing it.
 *
 * Static assets (/_next/static, images, fonts) are excluded from the matcher:
 * they are not documents and get the remaining security headers from
 * next.config.js.
 */

/** 16 random bytes, base64 — the CSP3 nonce format (no padding needed). */
/** Private, per-user surfaces. Kept in sync with the disallow list in robots.ts. */
const PRIVATE_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/repositories',
  '/scans',
  '/findings',
  '/websites',
  '/pull-requests',
  '/billing',
  '/settings',
  '/team',
  '/auth',
  '/share',
];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function middleware(request: NextRequest) {
  const nonce = makeNonce();
  const { header, value, reportOnly } = buildCsp({
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    nonce,
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    reportOnly: process.env.REPOVERIX_CSP_REPORT_ONLY === 'true',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next.js reads this request header and automatically adds the nonce to its
  // own inline bootstrap scripts and chunk loaders.
  if (!reportOnly) requestHeaders.set('Content-Security-Policy', value);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, value);

  if (isPrivatePath(request.nextUrl.pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: [
    // All documents except Next internals and passive static files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|woff2?)$).*)',
  ],
};
