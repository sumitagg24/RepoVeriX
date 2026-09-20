import type { Metadata } from 'next';

import { pageMetadata } from '@/lib/site';

/**
 * Auth routes are deliberately not indexable and carry no canonical URL: they
 * are account surfaces reached from links the product already owns.
 */
export const metadata: Metadata = pageMetadata({
  title: 'Account',
  description: 'Sign in, create an account, or recover access to a RepoVeriX workspace.',
  path: '/auth/sign-in',
  index: false,
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-canvas">{children}</div>;
}
