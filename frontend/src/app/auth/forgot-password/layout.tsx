import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Route metadata for /auth/forgot-password — see login/layout.tsx. */
export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a RepoVeriX password reset link by email.',
  robots: { index: false, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
