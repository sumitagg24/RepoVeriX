import * as React from 'react';
import type { Metadata } from 'next';

import { SignInForm } from '@/components/auth/forms';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to your RepoVeriX workspace.',
  path: '/auth/sign-in',
  index: false,
});

export default function SignInPage() {
  return (
    <React.Suspense fallback={null}>
      <SignInForm />
    </React.Suspense>
  );
}
