import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Route metadata for /auth/verify-email — see login/layout.tsx. */
export const metadata: Metadata = {
  title: 'Verify your email',
  description: 'Confirm the email address on your RepoVeriX account.',
  robots: { index: false, follow: true },
};

export default function VerifyEmailLayout({ children }: { children: ReactNode }) {
  return children;
}
