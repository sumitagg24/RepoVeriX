/** @type {import('next').NextConfig} */

// Browser-facing security headers applied to every page response.
//
// The full Content-Security-Policy (script nonce + strict-dynamic) is set per
// request by src/middleware.ts, which also threads the nonce into Next's own
// bootstrap scripts and the app's inline JSON-LD/theme scripts. Static
// headers here cover everything CSP doesn't. See SECURITY.md §7 for the
// policy rationale and the report-only rollout flag.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Never send the app origin (or anything after it) in the Referer of
  // outbound requests (avatar loads, external links).
  { key: 'Referrer-Policy', value: 'no-referrer' },
  // No RepoVeriX feature needs camera/mic/geolocation/payment; block them and
  // disable cross-site interest-cohort tracking of the app origin.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
  },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
];

const nextConfig = {
  reactStrictMode: true,
  // Do not advertise the framework (server header fingerprinting).
  poweredByHeader: false,
  images: {
    domains: ['avatars.githubusercontent.com', 'github.com'],
  },
  async headers() {
    return [
      {
        // Apply to all routes.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
