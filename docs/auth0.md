# Auth0 sign-in provider

RepoVeriX supports signing in via an Auth0 tenant. This page documents how to
configure Auth0 on both sides and where each value lands.

## Auth0 tenant setup

1. Create an Auth0 application (Regular Web App) in the Auth0 dashboard.
2. Copy these values from the application **Settings** tab:

   * **Domain** → `REPOVERIX_AUTH0_DOMAIN` (e.g. `repoverix.us.auth0.com`)
   * **Client ID** → `REPOVERIX_AUTH0_OAUTH_CLIENT_ID`
   * **Client Secret** → `REPOVERIX_AUTH0_OAUTH_CLIENT_SECRET`

3. Under **Application URIs**:

   * **Callback URL** — the backend OAuth callback:

     ```
     http://localhost:8000/api/v1/auth/oauth/auth0/callback
     ```

     Replace `http://localhost:8000` with your deployed backend origin (and
     `https://` in production).
   * **Allowed Logout URLs** — your frontend origin (optional unless you wire
     logout through Auth0).

4. Under **Connections**, enable the identity sources you want your users to be
   able to sign in with (Username-Password-Authentication, Google, GitHub, etc.).
   Auth0 then federates those back into RepoVeriX.

## Backend configuration

Copy `backend/.env.example` to `backend/.env` and fill in the Auth0 values:

```ini
REPOVERIX_AUTH0_DOMAIN=repoverix.us.auth0.com
REPOVERIX_AUTH0_OAUTH_CLIENT_ID=YOUR_AUTH0_CLIENT_ID
REPOVERIX_AUTH0_OAUTH_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET
```

`auth0` is already in
`auth_allowed_social_providers` (`backend/app/core/config.py`), so once the
credentials are set the **Auth0** button appears on `/auth/sign-in` and
`/auth/sign-up` automatically — no code change required.

## How the flow works

1. User clicks **Auth0** on the sign-in page.
2. The frontend navigates full-page to
   `GET /api/v1/auth/oauth/auth0/login?next=/dashboard`, which:
   * generates PKCE + an OAuth state cookie,
   * builds the Auth0 `/authorize` URL from `REPOVERIX_AUTH0_DOMAIN` (see
     `get_provider_spec` in `backend/app/services/oauth.py`),
   * redirects the browser to the Auth0 consent screen.
3. Auth0 redirects back to
   `GET /api/v1/auth/oauth/auth0/callback?code=...&state=...`, where the
   backend:
   * validates state + PKCE,
   * exchanges the code for tokens at `.../oauth/token`,
   * fetches the normalized profile at `.../userinfo`,
   * upserts a local `User` (email verified) and an `OAuthAccount`,
   * mints a RepoVeriX JWT and redirects to the frontend callback with the
     token in the URL query.
4. The frontend `/auth/oauth/callback` adopts the token and navigates to
   `next`.

## Verification

```bash
# backend
cd backend
python -m pytest tests/test_oauth.py -q
```

The provider spec test asserts that setting `REPOVERIX_AUTH0_DOMAIN` resolves
the authorize/token/userinfo URLs against that tenant instead of the static
fallback.
