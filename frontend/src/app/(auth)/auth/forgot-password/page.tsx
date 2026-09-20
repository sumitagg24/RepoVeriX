import * as React from 'react';
import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/auth/forms';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Reset your password',
  description: 'Request a single-use password reset link for your RepoVeriX account.',
  path: '/auth/forgot-password',
  index: false,
});

export default function ForgotPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ForgotPasswordForm />
    </React.Suspense>
  );
}
