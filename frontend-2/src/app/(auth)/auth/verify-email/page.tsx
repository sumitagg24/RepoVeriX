import * as React from 'react';
import type { Metadata } from 'next';

import { VerifyEmailFlow } from '@/components/auth/forms';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Verify your email',
  description: 'Confirm the email address on your RepoVeriX account to open imports and scans.',
  path: '/auth/verify-email',
  index: false,
});

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailFlow />
    </React.Suspense>
  );
}
