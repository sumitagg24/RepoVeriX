'use client';

import * as React from 'react';

import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';
import { Auth0Icon } from '@/components/auth/auth-shell';
import { isAuth0Configured } from '@/lib/auth0';

/**
 * Safe wrapper around `useAuth0`.
 *
 * `useAuth0` throws when used outside an `Auth0Provider`. Since Auth0 is
 * optional (it only wraps the app when its env vars are set), this hook
 * returns a noop session when Auth0 is not configured so every caller can
 * invoke it unconditionally — satisfying the Rules of Hooks — without ever
 * throwing.
 */
function useSafeAuth0() {
  let auth0: ReturnType<typeof useAuth0>;
  try {
    // Always invoked (Rules of Hooks). When Auth0 is not configured there is no
    // `Auth0Provider` in the tree, so `useAuth0` throws — we catch it and
    // return a noop session so callers never see an exception.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    auth0 = useAuth0();
  } catch {
    auth0 = {
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      loginWithRedirect: async () => {},
      logout: async () => {},
    } as ReturnType<typeof useAuth0>;
  }
  return auth0;
}

/**
 * Client-side Auth0 sign-in.
 *
 * Kicks off the Auth0 Universal Login flow via `loginWithRedirect`. After the
 * user authenticates, Auth0 redirects to `/auth/callback`, which hands the
 * session back and sends the user to the dashboard.
 */
export function Auth0SignInButton() {
  const { loginWithRedirect, isAuthenticated } = useSafeAuth0();

  if (!isAuthenticated && isAuth0Configured()) {
    return (
      <Button
        variant="secondary"
        size="md"
        className="w-full"
        onClick={() => void loginWithRedirect()}
      >
        <Auth0Icon className="mr-2 size-4" aria-hidden="true" />
        Continue with Auth0
      </Button>
    );
  }
  return null;
}

/**
 * Client-side Auth0 sign-up.
 *
 * Kicks off the Auth0 Universal Login flow with `screen_hint: "signup"` so the
 * user lands on the signup screen rather than the login screen.
 */
export function Auth0SignUpButton() {
  const { loginWithRedirect, isAuthenticated } = useSafeAuth0();

  if (!isAuthenticated && isAuth0Configured()) {
    return (
      <Button
        variant="secondary"
        size="md"
        className="w-full"
        onClick={() =>
          void loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } })
        }
      >
        <Auth0Icon className="mr-2 size-4" aria-hidden="true" />
        Create account with Auth0
      </Button>
    );
  }
  return null;
}

/**
 * Client-side Auth0 logout + user profile.
 *
 * Renders the signed-in user's profile and a logout button. Logout clears the
 * Auth0 session and returns the user to the origin.
 */
export function Auth0UserMenu({ className }: { className?: string }) {
  const {
    isAuthenticated,
    user,
    logout: auth0Logout,
    isLoading,
  } = useSafeAuth0();

  if (isLoading) return null;
  if (!isAuth0Configured() || !isAuthenticated) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-[13px] text-body">
        <div className="hidden sm:flex items-center gap-2">
          <span className="font-medium text-ink">{user?.email ?? 'User'}</span>
          <button
            onClick={() =>
              void auth0Logout({ logoutParams: { returnTo: window.location.origin } })
            }
            className="text-accent underline-offset-4 hover:underline"
            aria-label="Sign out of Auth0"
          >
            Sign out
          </button>
        </div>
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() =>
              void auth0Logout({ logoutParams: { returnTo: window.location.origin } })
            }
            className="text-accent underline-offset-4 hover:underline p-1"
            aria-label="Sign out of Auth0"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
