/** @type {import('next').NextConfig} */

/**
 * Production builds must never fall back to localhost.
 *
 * A bundle that points at http://localhost:8000 ships a site whose proxy
 * cannot reach the API at all — every request 502s and pages render without
 * any live data. When no explicit origin is configured, production therefore
 * defaults to the canonical deployed backend; `NEXT_PUBLIC_API_ORIGIN` /
 * `NEXT_PUBLIC_API_URL` still win whenever they are set.
 */
const DEFAULT_API_ORIGIN =
  process.env.VERCEL_ENV === 'production'
    ? 'https://repoverix.onrender.com'
    : 'http://localhost:8000';

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  DEFAULT_API_ORIGIN
).replace(/\/$/, '');

/**
 * The browser only ever talks to its own origin.
 *
 * Every backend call goes to `/api/v1/*` on this app, and the route handler at
 * `src/app/api/v1/[...path]/route.ts` forwards it to the FastAPI service. That
 * keeps the existing backend contract untouched (no CORS change, no new
 * endpoints) and means the session token never has to survive a cross-origin
 * preflight. `NEXT_PUBLIC_API_URL` is still honoured by the service layer for
 * deployments that prefer direct calls.
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  eslint: {
    dirs: ['src', 'scripts'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_ORIGIN: API_ORIGIN,
  },
};

export default nextConfig;
