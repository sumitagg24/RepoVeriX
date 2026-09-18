import * as React from 'react';
import type { Metadata } from 'next';

import { SignUpForm } from '@/components/auth/forms';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Create an account',
  description: 'Create a RepoVeriX account and run a first scan.',
  path: '/auth/sign-up',
  index: false,
});

export default function SignUpPage() {
  return (
    <React.Suspense fallback={null}>
      <SignUpForm />
    </React.Suspense>
  );
}
