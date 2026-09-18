import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Route metadata for /auth/reset-password — see login/layout.tsx. */
export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Set a new password for your RepoVeriX account.',
  robots: { index: false, follow: true },
};

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
