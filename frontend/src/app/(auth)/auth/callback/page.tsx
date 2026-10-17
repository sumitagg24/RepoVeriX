'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth0 } from '@auth0/auth0-react';

import { AuthShell } from '@/components/auth/auth-shell';
import { LoadingRegion } from '@/components/ui/states';

/**
 * Auth0 callback.
 *
 * After the user signs in or signs up on the Auth0 Universal Login page, Auth0
 * redirects back here with the result in the URL fragment. `handleRedirectCallback`
 * validates it and populates the `useAuth0` session, then we redirect to the
 * dashboard.
 */
export default function Auth0Callback() {
  const { handleRedirectCallback, isLoading, error } = useAuth0();
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await handleRedirectCallback();
        if (!cancelled) router.replace('/dashboard');
      } catch {
        // `handleRedirectCallback` surfaces failures through the `error` state,
        // so we let the render below handle them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleRedirectCallback, router]);

  if (isLoading) {
    return (
      <AuthShell
        title="Completing sign-in"
        description="Handing the Auth0 session back to your workspace."
      >
        <LoadingRegion label="Completing sign-in" className="panel px-5 py-6">
          <div className="flex items-center gap-3">
            <p className="text-[13.5px] text-ink">Validating the Auth0 session…</p>
          </div>
        </LoadingRegion>
      </AuthShell>
    );
  }

  if (error) {
    return (
      <AuthShell title="Sign-in was not completed">
        <p className="text-body">{error.message}</p>
      </AuthShell>
    );
  }

  return null;
}
