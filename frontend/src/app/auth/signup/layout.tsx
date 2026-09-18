import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Route metadata for /auth/signup — see login/layout.tsx for the rationale. */
export const metadata: Metadata = {
  title: 'Create your workspace',
  description:
    'Start free with RepoVeriX: connect a repository, run a scan, and see every finding backed by an evidence chain.',
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
