/** @type {import('next').NextConfig} */

/**
 * RepoVeriX frontend-2.
 *
 * API strategy: the browser always calls the backend on *this* origin. Next
 * proxies `/api/v1/*` to the FastAPI service server-side, so the app works from
 * port 3001 (or any origin) with **zero backend, CORS or environment changes**.
 *
 *   browser -> localhost:3001/api/v1/... -> localhost:8000/api/v1/...
 *
 * Set `API_ORIGIN` to point the proxy at a different backend deployment, or set
 * `NEXT_PUBLIC_API_URL` to bypass the proxy and call the backend directly (that
 * mode needs the backend's CORS origins to include this app's origin).
 */
const API_ORIGIN = (process.env.API_ORIGIN || 'http://localhost:8000').replace(/\/$/, '');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'gitlab.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
