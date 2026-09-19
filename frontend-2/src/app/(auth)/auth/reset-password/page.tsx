import * as React from 'react';
import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/auth/forms';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Choose a new password',
  description: 'Set a new password for your RepoVeriX account from a single-use reset link.',
  path: '/auth/reset-password',
  index: false,
});

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}
