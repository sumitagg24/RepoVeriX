# SECURITY.md — RepoVeriX hardening notes

Status of each area from the security checklist, what is enforced in code, and
what an operator must still do by hand.

---

## 1. Rate limiting

All thresholds live in `backend/app/core/config.py` (env `REPOVERIX_*`) and are
enforced by `backend/app/core/ratelimit.py`. **Nothing is hardcoded at the
enforcement point.**

| Tier | Applies to | Default | Keyed by |
|---|---|---|---|
| Auth (strict) | `POST /auth/login`, `POST /auth/signup` | 8 attempts / 5 min | client IP **and** account email — a request must pass **both** |
| Public (moderate) | Unauthenticated `/api/v1/*` (OAuth entrypoints, provider listing) | 120 / min | client IP |
| User (loose) | Every authenticated API call | 600 / min | user id (JWT `sub`) |
| Action (per-op) | Scan creation, ZIP / archive / OAuth imports, LLM fix generation, sandbox verification | 15 / min | user id + action |

**Backoff, not lockout.** When an auth budget is exhausted the client is
refused with `429 + Retry-After`. Each repeated refusal doubles the wait from
`REPOVERIX_AUTH_BACKOFF_BASE_SECONDS` (30 s) up to
`REPOVERIX_AUTH_BACKOFF_MAX_SECONDS` (1 h). Once a lockout is *served*, the
client gets a fresh budget — legitimate users are never banned permanently, but
brute-force bursts are punished exponentially. A successful login clears only
the *account* bucket, so a shared IP cannot flood account creation by chaining
successes.

Operational notes:

- The limiter is **in-process** (`threading`-locked dict). Run a single API
  worker, or pin auth traffic to one worker, or swap `RateLimiter` for a Redis
  backend (same three-function interface: `check` / `reset` / `clear`).
- Set `REPOVERIX_TRUST_PROXY_HEADERS=true` **only** behind a reverse proxy that
  overwrites `X-Forwarded-For`. Otherwise clients can spoof it.
- Toggle everything off for local automation with
  `REPOVERIX_RATE_LIMIT_ENABLED=false` (the test suite does this).

## 2. Input validation

FastAPI + Pydantic reject on schema mismatch — nothing is "sanitized then
accepted":

- Emails: `EmailStr`, normalized to lower-case for storage and lookup.
- Passwords: 8–128 chars at signup; only ever stored as bcrypt hashes.
- Names/branches: stripped; whitespace-only rejected; git-forbidden branch
  characters rejected (` \t ~ ^ : ? * [ \` and control chars).
- URLs: `HttpUrl` (http/https only) for archive and repo sources.
- OAuth imports: `repo_path` must match `owner/name` (GitLab namespaces
  allowed) with no empty or `..` segments.
- List endpoints: `limit` clamped (1–200 / 1–500) and `offset >= 0`.
- Filter query params are parameterized SQL — no injection surface.

## 3. Secrets

- Repo-wide scan (patterns for `sk-`, `AIza`, `ghp_`, `AKIA`, `xox*`, PEM
  keys, JWTs) found **no real credentials** — only deliberately faked
  `sk-demo-*` fixtures used to test the secret detector itself.
- `.gitignore` excludes `.env*`; only `.env.example` templates are tracked.
- The frontend references only `NEXT_PUBLIC_API_URL` (build-time); nothing
  secret is bundled client-side.
- **Operator:** replace `REPOVERIX_JWT_SECRET` (default `change-me-in-production`)
  and set LLM/OAuth keys via environment variables — never in code. Rotate
  anything that ever touched a repo/chat log.

## 4. Dependency vulnerabilities

Audit tooling: `npm audit` (frontend), `pip-audit` against the backend venv.

**Backend** — upgraded (suite green): `fastapi 0.141.1`, `starlette 1.6.0`,
`python-multipart 0.0.32`, `pydantic-settings 2.15.0`, `python-dotenv 1.2.3`,
closing the flagged PYSEC/GHSA entries for those packages. Residual: none for
project dependencies. (The dev machine's global site-packages contains strays
like `moviepy`/`python-jose`/`pillow` that the project never imports; a clean
deploy uses the locked venv/Docker image.)

**Frontend** — upgraded `next` `14.2.5 → 14.2.35` and `eslint-config-next` to
match, clearing the original 8 advisories (7 high, 1 critical). Residual flags
**require a breaking major** (Next 15/16 + React 19) and are tracked as the
next upgrade:

- `next@14.2.35` — still inside the vulnerable range of a long tail of
  advisories (image-optimizer DoS, RSC/cache issues, rewrite smuggling). Most
  require features this app does not use (no `next/image` usage, no Server
  Actions, no middleware, no i18n); `next.config.js` rewrites point only at the
  static backend origin. **Action:** plan a Next 15/16 + React 19 upgrade.
- `glob@10.3.10` (dev-only, inside `@next/eslint-plugin-next`) — the advisory
  is about the `glob` CLI's `-c/--cmd` flag with `shell:true`; the lint plugin
  never invokes the CLI that way.

## 5. Error handling & information leakage

- **Global handler** (`app/main.py`): any unhandled exception is logged
  server-side with full traceback and request line, and the client receives a
  fixed `500 {"detail":"Internal server error"}` — no stack traces, paths, or
  DB errors.
- HTTPException / validation responses keep their structured, message-scoped
  bodies (`"Repository not found"`, `"Invalid credentials"`, …).
- OAuth internals are no longer echoed: provider exchange errors and repo-list
  failures log details server-side and return generic messages
  (`oauth_failed`, "Reconnect the account…"). Browser redirects carry fixed
  error codes, never raw provider text.
- Owned-resource lookups are ownership-scoped and return `404`, not `403`, so
  existence of other users' resources is not disclosed.

## 6. File upload safety

`POST /repositories/zip`:

- **Size:** streamed to disk in 1 MB chunks under `REPOVERIX_MAX_UPLOAD_BYTES`
  (default 110 MB) — never buffered whole in memory; oversized uploads abort
  mid-stream and are deleted.
- **Content, not extension:** after storing, the payload is magic-sniffed
  (`PK\x03\x04` / `PK\x05\x06`) and rejected if it is not a real ZIP — a file
  named `.zip` full of anything else never becomes a repository.
- **Storage isolation:** archives live under `REPOVERIX_REPOSITORY_STORAGE_DIR`
  (per-repository uuid dirs) outside any web root; the API serves no static
  files from there, so nothing uploaded is ever fetchable or executable as
  code. Extraction writes plain files only (no symlink creation) with
  path-traversal, per-member-size and total-size guards, and a second-pass
  extractor (`app/analysis/ingest.py`).
- Scan-time downloads (S3/archive URLs) enforce the same limits while
  streaming, and git clones are `--depth 1` with a timeout and the `.git`
  directory removed afterwards.
- **Action (per user, per minute):** `imports`, capped via the action tier.

---

## 7. Content-Security-Policy

Enforced per-request by `frontend/src/middleware.ts` using the documented
Next.js nonce pattern (`src/lib/csp.ts` builds the policy — unit-tested in
`src/lib/__tests__/csp.test.ts`):

- **`script-src 'nonce-<random>' 'strict-dynamic'`** — the strict part of the
  policy. Every response carries a fresh 16-byte nonce; middleware also sets it
  on the *request* headers, which Next.js reads to auto-nonce its own bootstrap
  and chunk scripts. App-owned inline scripts (theme bootstrap, JSON-LD) read
  the nonce via `getNonce()` (`src/lib/csp-server.ts`). No `unsafe-inline` for
  scripts, no script host allowlist: an injected `<script>` without the
  per-request nonce cannot execute.
- **`style-src 'self' 'unsafe-inline'`** — accepted trade-off: React renders
  dynamic `style={{}}` attributes (progress bars, gauges) that CSP cannot
  nonce. Style injection does not execute code.
- **`connect-src`** includes `NEXT_PUBLIC_API_URL` (the browser calls the
  FastAPI backend directly) plus the same-origin proxy; dev additionally
  allows `ws:`/`wss:` (HMR) and `'unsafe-eval'` (react-refresh).
- **Locked:** `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`,
  `form-action 'self'`, `frame-src 'none'`; `upgrade-insecure-requests` in
  production only.
- **Rollout canary:** set `REPOVERIX_CSP_REPORT_ONLY=true` to emit the policy
  as `Content-Security-Policy-Report-Only` while observing violation reports
  before enforcing.
- Known limitation (dev-only cosmetic): Fast Refresh re-renders cannot read
  request headers, so React may log a nonce-prop hydration warning in dev.
  Enforcement is unaffected — the attribute is correct at HTML parse time.

---

## Verified

Backend: **118 pytest tests** (incl. dedicated `tests/test_ratelimit.py` —
window semantics, exponential escalation, cap, reset-on-success, per-IP
signup flood, per-user action budget — and `tests/test_security.py` — generic
500 + server-side logging, non-ZIP rejection, email case-insensitivity,
malformed `repo_path` rejection). `ruff check` + `ruff format --check` clean.
Frontend gates unchanged and green (`tsc`, lint, jest, production build).
