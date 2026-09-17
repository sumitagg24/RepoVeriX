'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ONBOARDING_CONNECT_FLAG } from '@/lib/onboarding';
import { Loader2 } from 'lucide-react';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithToken } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const provider = searchParams.get('provider') || '';

    if (error) {
      const message =
        error === 'access_denied'
          ? 'You cancelled the sign-in. No changes were made.'
          : error === 'not_configured'
            ? 'This sign-in provider is not configured on the server yet.'
            : error.startsWith('oauth:')
              ? error.slice(6)
              : 'Something went wrong during sign-in.';
      router.replace(`/auth/login?oauth_error=${encodeURIComponent(message)}`);
      return;
    }

    if (!token) {
      router.replace('/auth/login?oauth_error=Missing token from provider');
      return;
    }

    loginWithToken(token).then(() => {
      // A connect started from the onboarding wizard returns there; regular
      // GitHub/GitLab connects land back in the import dialog for that provider.
      if (typeof window !== 'undefined' && sessionStorage.getItem(ONBOARDING_CONNECT_FLAG) === '1') {
        sessionStorage.removeItem(ONBOARDING_CONNECT_FLAG);
        router.replace('/onboarding');
      } else if (provider === 'github' || provider === 'gitlab') {
        router.replace(`/repositories?import=1&tab=${provider}`);
      } else {
        router.replace('/dashboard');
      }
    });
  }, [searchParams, router, loginWithToken]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
