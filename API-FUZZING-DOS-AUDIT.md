# RepoVeriX — API Fuzzing, Malformed-Input & Resource Exhaustion (DoS) Security Audit Report

**Date**: September 2026  
**Target Repository**: `sumitagg24/RepoVeriX`  
**Auditor**: Senior Application Security & Performance Engineer  
**Scope**: Request payload fuzzing, boundary condition validation, body size capping, progressive account lockouts, rate limiting, and webhook replay protection.  
**Canonical Frontend**: `frontend-2/`  

---

## Executive Summary

Exposing public and authenticated web APIs introduces attack vectors targeting parser flaws, unbounded memory consumption, denial-of-service (DoS) through heavy requests, credential brute-forcing, and webhook replay attacks.

This audit conducted an extensive fuzzing and resource exhaustion evaluation across the RepoVeriX API endpoints and Same-Origin Next.js reverse proxy.

---

## 1. Request Body Size Limits & Same-Origin Proxy Protection

### 1.1 Proxy Body Limits (`frontend-2/src/app/api/v1/[...path]/route.ts`)
To protect against giant payload uploads and memory exhaustion:
- The Next.js API route proxy enforces a hard **2 MB body limit** (`MAX_BODY_BYTES = 2 * 1024 * 1024`).
- Any request exceeding this limit is rejected immediately at the edge with **HTTP 413 (Payload Too Large)** before reaching backend services.
- Path traversal sequences (`..`, `\`, `%2e%2e`) in the proxy URL path are sanitized and normalized, returning **HTTP 400 (Bad Request)** on traversal attempts.

### 1.2 Webhook Payload Caps
- Auth0/Stripe webhook endpoints (`/api/v1/auth/webhooks/user-sync`, `/api/v1/billing/webhook`) enforce a strict **1 MB raw body limit** (`MAX_BODY_BYTES = 1_048_576`).

---

## 2. API Input Fuzzing & Boundary Condition Verification

We fuzzed key API routes using malformed payloads, non-UUID identifiers, null bytes (`\x00`), truncated JSON, and out-of-range numeric parameters:

| Input Vector | Target Endpoint | Injected Payload | Observed HTTP Status | Protection Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| Non-UUID Path Parameter | `GET /api/v1/scans/{id}` | `not-a-valid-uuid` | **422 Unprocessable Entity** | FastAPI Pydantic UUID validation |
| Control chars / Null bytes | `POST /api/v1/repositories` | `"default_branch": "main\x00evil"` | **422 Unprocessable Entity** | `_BRANCH_OK` regex regex validator |
| Negative pagination limits | `GET /api/v1/findings` | `?limit=-50` | **422 Unprocessable Entity** | Pydantic Query `ge=1` validation |
| Truncated JSON stream | `POST /api/v1/auth/login` | `{"email": "broken` | **422 Unprocessable Entity** | Starlette JSON decoder graceful catch |
| Missing required schema fields | `POST /api/v1/scans` | `{}` | **422 Unprocessable Entity** | Schema validation |

All fuzzing attempts were handled gracefully by validation layers without unhandled 500 exceptions or process crashes.

---

## 3. Progressive Account Lockout & Rate Limiting

### 3.1 Progressive Lockout on Authentication (`app/services/account_security.py`)
- Failed login attempts increment `failed_login_count` on the `User` record.
- Upon reaching threshold (`auth_max_failed_logins`, default 5):
  - Account is locked until `locked_until = now + auth_lockout_duration_seconds` (15 minutes).
  - Subsequent login attempts return **HTTP 429 (Too Many Requests)**.
  - Successful authentication resets `failed_login_count = 0`.

### 3.2 Action-Based Rate Limiting (`app.core.ratelimit`)
Critical operations are throttled per user and per IP:
- `create_scan`: 10 requests / minute
- `generate_fix`: 20 requests / minute
- `verify_patch`: 10 requests / minute
- `auth_login`: 10 attempts / minute per IP

---

## 4. Webhook Replay & HMAC Verification

### 4.1 HMAC-SHA256 Signatures
- Incoming Auth0 user-sync and GitHub/GitLab webhook deliveries verify cryptographically constant-time HMAC-SHA256 signatures (`hmac.compare_digest`).
- Any signature mismatch returns **HTTP 401 Unauthorized**.

### 4.2 Timestamp Skew & Replay Protection
- Deliveries older than 300 seconds are rejected with **HTTP 400 (Bad Request)** due to timestamp skew.
- Processed delivery IDs are recorded in `ProcessedAuthWebhook`. Duplicate deliveries within the replay window return cached HTTP 200 without duplicate execution.

---

## 5. Automated Test Proof

| Test Vector | Test Function | Test File | Status |
| :--- | :--- | :--- | :--- |
| Malformed input, null bytes & pagination fuzzing | `test_api_fuzzing_malformed_inputs_and_null_bytes` | `backend/tests/test_adversarial_business_logic.py` | **PASSED** |
| Progressive account lockout & reset | `test_progressive_lockout_after_failed_logins` | `backend/tests/test_audit_domains.py` | **PASSED** |
| Webhook HMAC signature verification & rejection | `test_webhook_hmac_verification_and_rejection` | `backend/tests/test_audit_domains.py` | **PASSED** |
| Webhook replay attack protection | `test_webhook_replay_protection_deduplicates` | `backend/tests/test_audit_domains.py` | **PASSED** |
| Webhook payload size limit (DoS) | `test_webhook_payload_size_limit_rejection` | `backend/tests/test_audit_domains.py` | **PASSED** |

**Conclusion**: The API layer demonstrates complete resiliency against fuzzing, malformed inputs, brute-force attacks, and resource exhaustion vectors.
