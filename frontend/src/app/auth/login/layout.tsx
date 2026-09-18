import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Route metadata for /auth/login.
 *
 * The page below is a client component (`'use client'`), and client components
 * cannot export `metadata` — so before this file existed every auth screen
 * shared the root layout's title and had no description of its own. A server
 * layout is the smallest way to give each route its own metadata without
 * restructuring pages that already work.
 *
 * `noindex` matches robots.ts and the `X-Robots-Tag` header middleware sets for
 * /auth: these screens are for returning users, not search results.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to RepoVeriX to review repository findings, follow evidence chains and verify repairs.',
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
