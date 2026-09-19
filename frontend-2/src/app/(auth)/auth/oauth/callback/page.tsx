import * as React from 'react';
import type { Metadata } from 'next';

import { OAuthCallback } from '@/components/auth/forms';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Completing sign-in',
  description: 'Handing the provider session back to your RepoVeriX workspace.',
  path: '/auth/oauth/callback',
  index: false,
});

export default function OAuthCallbackPage() {
  return (
    <React.Suspense fallback={null}>
      <OAuthCallback />
    </React.Suspense>
  );
}
