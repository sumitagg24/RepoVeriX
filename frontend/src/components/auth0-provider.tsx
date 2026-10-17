'use client';

import type { ReactNode } from 'react';

import { Auth0Provider } from '@auth0/auth0-react';

import { auth0CallbackUrl, auth0ClientId, auth0Domain } from '@/lib/auth0';

/**
 * Wraps the app with Auth0's `Auth0Provider` so `useAuth0` is available
 * everywhere. When Auth0 is not configured (missing env vars), children are
 * rendered unwrapped so the rest of the app (email/password auth) keeps
 * working and nothing throws.
 */
export function Auth0ProviderWrapper({ children }: { children: ReactNode }) {
  const domain = auth0Domain();
  const clientId = auth0ClientId();
  const callbackUrl = auth0CallbackUrl();

  if (!domain || !clientId || !callbackUrl) {
    return <>{children}</>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: callbackUrl,
      }}
    >
      {children}
    </Auth0Provider>
  );
}
