/**
 * Auth0 configuration for the client-side `@auth0/auth0-react` SDK.
 *
 * Values come from `NEXT_PUBLIC_AUTH0_*` environment variables (inlined at
 * build time, so they are safe to read inside client components). Copy
 * `.env.example` to `.env.local` and fill in the values from your Auth0
 * Single Page Application.
 *
 * The Auth0 application must allow:
 *   Allowed Callback URLs:    ${NEXT_PUBLIC_AUTH0_CALLBACK_URL}
 *   Allowed Logout URLs:      ${origin} (e.g. http://localhost:3001)
 *   Allowed Web Origins:      ${origin}
 */

export function auth0Domain(): string | undefined {
  return process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
}

export function auth0ClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
}

export function auth0CallbackUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_AUTH0_CALLBACK_URL;
}

export function isAuth0Configured(): boolean {
  return Boolean(auth0Domain() && auth0ClientId());
}
