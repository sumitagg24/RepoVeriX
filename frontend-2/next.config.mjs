/** @type {import('next').NextConfig} */

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:8000').replace(
  /\/$/,
  '',
);

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
  eslint: {
    dirs: ['src', 'scripts'],
  },
  experimental: {
    // The dev server is reached over 127.0.0.1 as well as localhost from the
    // preview webview; allow both without weakening the production defaults.
    allowedDevOrigins: ['localhost', '127.0.0.1'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_ORIGIN: API_ORIGIN,
  },
};

export default nextConfig;
