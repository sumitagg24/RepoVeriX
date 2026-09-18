# RepoVeriX — Security Guide

## Critical Secrets (must be set in production)

| Variable | Purpose | How to generate |
|---|---|---|
| `REPOVERIX_JWT_SECRET` | Signs all session JWTs. **Startup refuses with a hard error if this is the default value and the host allowlist includes non-loopback hosts.** | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `REPOVERIX_TOKEN_ENCRYPTION_KEY` | Fernet key: encrypts OAuth access/refresh tokens stored in the database. Without it, tokens are stored in plaintext. | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `REPOVERIX_STRIPE_WEBHOOK_SECRET` | Authenticates inbound Stripe events. | Copy from Stripe Dashboard → Webhooks → Signing secret. |
| `REPOVERIX_AUTH_WEBHOOK_SECRET` | HMAC secret for inbound auth-sync webhook events (`POST /auth/webhooks/events`). Without it the receiver returns 503. | `python -c "import secrets; print(secrets.token_hex(32))"` |

---

## Multi-Worker Deployments

### Rate limiting

The default rate limiter (`app/core/ratelimit.py`) is **process-local**. In a
multi-worker deployment (multiple Uvicorn processes or replicas) each worker
has its own independent counter state.

**Consequence**: auth brute-force budgets are per-worker.  An attacker who can
round-robin across N workers gets N× the per-window attempt budget.

**Fix**: set `REPOVERIX_REDIS_URL` to a shared Redis instance.

```bash
REPOVERIX_REDIS_URL=redis://redis:6379/0
```

The `_AsyncLimiterAdapter` in `ratelimit.py` will automatically pick up the
Redis backend on startup. The optional dependency is installed with:

```bash
pip install "repoverix-backend[redis]"
```

If the Redis server is unreachable at startup, the process-local limiter is
used as a fallback and a warning is logged.

### Scan / verification job state

The in-process asyncio task scheduler (`app/analysis/runtime.py`) does not
share state between workers.  A scan started on worker A is invisible to
worker B:

- **Duplicate jobs**: a webhook delivery hitting worker B while worker A
  already has the scan running will start a second scan.  The idempotency key
  on `Scan` prevents duplicate *rows* but not duplicate in-flight coroutines.
- **Cancellation**: `DELETE /scans/{id}` only cancels the task if it hit the
  same worker.

**Recommended fix for production multi-worker**: replace `schedule_scan` and
`schedule` in `app/analysis/runtime.py` with a distributed task queue
(Celery + Redis, ARQ, or Dramatiq).  The route handlers call these via the
`get_scan_scheduler` / `get_verification_scheduler` FastAPI dependencies —
swap the dependency implementation without touching any route code.

---

## Authentication

### JWT session tokens

- Algorithm: HS256, signed with `REPOVERIX_JWT_SECRET`.
- Expiry: `REPOVERIX_ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440 = 24 h).
- Revocable: every token carries a `tv` (token version) claim. Bumping
  `User.token_version` (on password change, reset, logout-all, suspension)
  rejects all previously issued tokens for that user.

### API tokens (`rvx_…`)

- Only the SHA-256 hash is stored; the plaintext is returned once at creation.
- Revocable by setting `ApiToken.revoked_at`; expiry via `expires_at`.
- `last_used_at` is updated best-effort (never fails auth on DB error).

### OAuth tokens

- Stored encrypted at rest (Fernet) when `REPOVERIX_TOKEN_ENCRYPTION_KEY` is
  set.  The key must be rotated using the procedure below.

### Account lockout

Progressive per-account lockout on failed logins:

1. After `REPOVERIX_AUTH_MAX_FAILED_ATTEMPTS` consecutive failures
   (default 5), the account is locked for `REPOVERIX_AUTH_LOCKOUT_MINUTES`
   (default 5 min).
2. Each subsequent failure doubles the lockout (× `AUTH_LOCKOUT_BACKOFF_MULTIPLIER`),
   capped at `REPOVERIX_AUTH_MAX_LOCKOUT_MINUTES` (default 120 min).
3. A successful login resets the counter.

Rate-limit windows enforce a separate per-IP + per-account budget at the HTTP
layer (independent of the DB lockout above).

---

## SSRF Protection

All outbound fetches that accept user-supplied URLs (git clone, archive
download, OAuth token exchange) are guarded by `app/core/ssrf.py`:

- Resolves the hostname before connecting.
- Rejects RFC-1918 (`10/8`, `172.16/12`, `192.168/16`), loopback (`127/8`,
  `::1`), link-local (`169.254/16`, `fe80::/10`), and cloud-metadata
  (`169.254.169.254`, `fd00:ec2::254`) addresses.
- **Override**: `REPOVERIX_SSRF_ALLOW_PRIVATE_HOSTS=true` disables the
  guard for self-hosted deployments that intentionally import from an internal
  Git server. Never enable this in a multi-tenant environment.

---

## Sandbox (Docker)

Patch verification and generated test execution run inside a Docker container
with:

| Limit | Setting | Default |
|---|---|---|
| CPU | `REPOVERIX_SANDBOX_CPU_LIMIT` | `1.0` cores |
| Memory | `REPOVERIX_SANDBOX_MEMORY_LIMIT` | `1g` |
| PIDs | `REPOVERIX_SANDBOX_PIDS_LIMIT` | `256` |
| Timeout | `REPOVERIX_SANDBOX_TIMEOUT_SECONDS` | `600` |
| Network | `REPOVERIX_SANDBOX_NETWORK` | `bridge` |

Set `SANDBOX_NETWORK=none` to fully air-gap verification containers (pip/npm
installs will then fail — use only when dependencies are pre-installed in the
image). `bridge` allows package downloads during the deps-install step.

Docker must be available on the host (`docker` CLI in `$PATH`).  If Docker is
not available, the `LocalRunner` fallback is used — **only safe for trusted
development fixtures**; never use it for untrusted code in production.

---

## Email Security

Sensitive one-time links (email verification, password reset) are:

1. Generated as cryptographically random tokens (`secrets.token_urlsafe`).
2. Stored as SHA-256 hashes — a database leak cannot yield a usable link.
3. Expire after `REPOVERIX_EMAIL_VERIFICATION_TOKEN_MINUTES` /
   `REPOVERIX_PASSWORD_RESET_TOKEN_MINUTES`.
4. Anti-abuse budgets: `REPOVERIX_EMAIL_RESEND_PER_HOUR` and
   `REPOVERIX_PASSWORD_RESET_PER_HOUR` (per email address, per hour).

In production set `REPOVERIX_EMAIL_BACKEND=smtp` and configure:

```
REPOVERIX_SMTP_HOST=smtp.example.com
REPOVERIX_SMTP_PORT=587
REPOVERIX_SMTP_USERNAME=…
REPOVERIX_SMTP_PASSWORD=…
REPOVERIX_SMTP_FROM=RepoVeriX <no-reply@example.com>
```

The `console` backend logs the full email body to stdout (including one-time
links). **Never use `console` in production.**

---

## Webhook Security

### Repository push webhooks (GitHub / GitLab)

- Secret generated with `secrets.token_urlsafe(24)` prefixed `rvxwh_`.
- GitHub: verified via `X-Hub-Signature-256` (HMAC-SHA256).
- GitLab: verified via `X-Gitlab-Token` (constant-time equality).
- Verification runs against the **raw body bytes** before any JSON parsing.
- Body capped at 256 KB; oversized payloads are rejected with 413.

### Stripe webhooks

- Verified via `stripe.Webhook.construct_event` (timestamp + HMAC-SHA256).
- Requires `REPOVERIX_STRIPE_WEBHOOK_SECRET` (from the Stripe Dashboard).
- In demo mode (`REPOVERIX_BILLING_DEMO_MODE=true`) the endpoint is a no-op.

### Auth-sync webhooks

- Guarded by HMAC-SHA256 over the raw body using `REPOVERIX_AUTH_WEBHOOK_SECRET`.
- Idempotent: processed event IDs are stored in `ProcessedAuthWebhook` to
  prevent replay attacks.
- Returns 503 when `AUTH_WEBHOOK_SECRET` is unset (disabled by default).

---

## Secret Rotation

### JWT secret

1. Set `REPOVERIX_JWT_SECRET` to a new value.
2. Restart all API workers.
3. All existing sessions are immediately invalidated — users must log in again.

### Fernet token encryption key

Rotating the Fernet key requires re-encrypting every stored OAuth token:

```bash
# 1. Generate a new key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# 2. Run the migration script (decrypt with old key, re-encrypt with new)
python scripts/rotate_fernet_key.py \
    --old-key "$OLD_KEY" \
    --new-key "$NEW_KEY"

# 3. Update REPOVERIX_TOKEN_ENCRYPTION_KEY and restart workers
```

> The `rotate_fernet_key.py` script is in `backend/scripts/`. It processes
> rows in batches with a DB transaction per batch so a restart mid-migration
> can be safely retried.

### API token compromise

1. `DELETE /api/v1/tokens/{id}` (sets `revoked_at`).
2. If the full token value is unknown, use `GET /api/v1/tokens` to list by
   prefix and revoke all tokens for the affected user.

---

## Production Checklist

- [ ] `REPOVERIX_JWT_SECRET` — strong random value, not the default
- [ ] `REPOVERIX_TOKEN_ENCRYPTION_KEY` — Fernet key set
- [ ] `REPOVERIX_ALLOWED_HOSTS` — set to your public hostname(s)
- [ ] `REPOVERIX_CORS_ORIGINS` — set to your frontend origin(s) only
- [ ] `REPOVERIX_EXPOSE_API_DOCS=false` — keep interactive docs off
- [ ] `REPOVERIX_DEBUG=false`
- [ ] `REPOVERIX_EMAIL_BACKEND=smtp` — SMTP credentials configured
- [ ] `REPOVERIX_TRUST_PROXY_HEADERS=true` — only when behind a trusted reverse proxy
- [ ] `REPOVERIX_REDIS_URL` — set for multi-worker rate limiting
- [ ] `REPOVERIX_STRIPE_WEBHOOK_SECRET` — if billing is enabled
- [ ] `REPOVERIX_AUTH_WEBHOOK_SECRET` — if auth-sync webhooks are used
- [ ] `REPOVERIX_BILLING_DEMO_MODE=false` — for live billing
- [ ] Docker available on host — for sandbox verification
- [ ] PostgreSQL (not SQLite) — for production workloads
- [ ] Alembic migrations run — `alembic upgrade head`
- [ ] `REPOVERIX_AUTO_CREATE_TABLES=false` — rely on Alembic, not `init_db()`
