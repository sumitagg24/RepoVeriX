# RepoVeriX — Webhook Security & Event Integrity Audit Report

**Audit Target**: Inbound & Outbound Webhook Pipelines  
**Endpoints Audited**:
1. `POST /api/v1/webhooks/{repository_id}` (GitHub & GitLab push-to-rescan webhooks)
2. `POST /api/v1/billing/webhook` (Stripe subscription events)
3. `POST /api/v1/auth/webhooks/user-sync` (Inbound IdP account sync)
**Audit Scope**: Cryptographic Authentication, Constant-Time Comparison, Replay Protection, Tenant Scoping, SSRF Defenses, and DoS Safeguards.

---

## 1. Webhook Pipeline Inventory

RepoVeriX implements three inbound webhook endpoints for automation and lifecycle synchronization:

| Endpoint | Sender | Purpose | Signature Standard |
|---|---|---|---|
| `/api/v1/webhooks/{repository_id}` | GitHub / GitLab | Triggers automated re-scan on default branch push | `X-Hub-Signature-256` (HMAC-SHA256) / `X-Gitlab-Token` |
| `/api/v1/billing/webhook` | Stripe | Real-time subscription state and tier updates | `Stripe-Signature` (v1 HMAC-SHA256 + timestamp) |
| `/api/v1/auth/webhooks/user-sync` | Identity Provider | User account creation/update/deletion sync | `X-RVX-Signature` (HMAC-SHA256 over raw body) |

*Outbound Webhooks*: RepoVeriX does not currently offer configurable custom outbound webhooks to third-party endpoints. Outbound alerts operate via direct authenticated integrations (GitHub PR check runs, email notifications).

---

## 2. Cryptographic Authentication & Signature Validation

### 2.1 Repository Webhooks (`app/api/routes/webhooks.py`)
- **Raw Body Integrity**: Verification is performed strictly on `await request.body()` bytes before JSON deserialization, preventing hash mismatch from key re-ordering or whitespace normalisation.
- **Constant-Time Comparison**:
  ```python
  def verify_delivery(repository: Repository, request: Request, body: bytes) -> str:
      secret = repository.webhook_secret
      gh_sig = request.headers.get("x-hub-signature-256", "")
      gl_token = request.headers.get("x-gitlab-token", "")
      if gh_sig:
          if not hmac.compare_digest(gh_sig, _github_signature(secret, body)):
              raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")
          return "github"
      if gl_token:
          if not hmac.compare_digest(gl_token, secret):
              raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")
          return "gitlab"
  ```
- **Secret Isolation**: Secrets are generated per repository using `secrets.token_urlsafe(24)` with prefix `rvxwh_`. Plaintext secret is returned exactly once during rotation and never logged.

### 2.2 Stripe Webhooks (`app/api/routes/billing.py`)
- Verified using official SDK `stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)` with timestamp tolerance to protect against replay attacks.

### 2.3 Identity Provider User Sync (`app/api/routes/account_security.py`)
- HMAC-SHA256 signature verified against `REPOVERIX_AUTH_WEBHOOK_SECRET` with `hmac.compare_digest`.
- If secret is unset, receiver fails closed with `HTTP 503 Service Unavailable`.

---

## 3. Replay Protection & Idempotency

1. **Auth Webhook Ledger (`ProcessedAuthWebhook`)**:
   - Every processed webhook ID is recorded in `processed_auth_webhooks` table with a unique constraint `(provider, event_id)`.
   - Replays receive `{ "detail": "duplicate" }` with HTTP 200 without executing state mutations.
2. **Repository Push Webhooks**:
   - In-flight check: If a scan is currently `pending` or `running` on the repository, duplicate deliveries return `{ "status": "in_flight" }` rather than queueing concurrent redundant scans.
   - Scan records assign `idempotency_key="webhook:{delivery_id}"`.

---

## 4. DoS & Payload Size Protections

- **Body Size Cap**: `MAX_WEBHOOK_BODY_BYTES = 256 * 1024` (256 KB) enforced before JSON decoding. Requests exceeding the cap fail immediately with `HTTP 413 Request Entity Too Large`.
- **Event Filtering**: Push payloads on non-default branches are immediately discarded with `{ "status": "ignored" }` without initiating clone or analysis pipelines.
