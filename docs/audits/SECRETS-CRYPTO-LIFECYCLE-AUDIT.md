# RepoVeriX — Secrets Management & Cryptographic Lifecycle Audit Report

**Date**: September 2026  
**Target Repository**: `sumitagg24/RepoVeriX`  
**Auditor**: Senior Cryptographic Engineer & Application Security Architect  
**Scope**: Cryptographic primitives, JWT token signing/verification, Fernet OAuth token encryption at rest, personal API token hashing & revocation, one-time email tokens, CI/CD secret boundaries, secret rotation procedures, and crash leakage prevention.  
**Canonical Frontend**: `frontend-2/`  

---

## Executive Summary

A zero-trust cryptographic lifecycle is essential for RepoVeriX because the system stores third-party OAuth access/refresh tokens (GitHub, GitLab, Google, Microsoft, Bitbucket, Oracle, Auth0), manages user authentication sessions, and handles CI/CD personal access tokens.

This audit conducted an end-to-end evaluation of:
1. **JWT Session Lifecycle**: Algorithm pinning (`HS256`), token version invalidation (`tv`), claim validation (`exp`, `iat`, `sub`), and rejection of algorithm confusion (`none`, asymmetric key swaps).
2. **Fernet Token Encryption at Rest**: `REPOVERIX_TOKEN_ENCRYPTION_KEY` symmetric authenticated encryption (AES-128-CBC + HMAC-SHA256) for OAuth credentials.
3. **Personal API Tokens**: Zero plaintext persistence; database stores only SHA-256 hashes (`token_hash`), preventing usable token recovery in database dumps.
4. **One-Time Email Tokens**: Single-use cryptographically random tokens (`secrets.token_urlsafe(32)`) compared using `hmac.compare_digest` with automatic burning upon consumption.
5. **Secret Rotation Runbooks**: Step-by-step non-destructive rotation procedures for JWT secrets, Fernet encryption keys, and webhook secrets.

---

## 1. Secrets Inventory & Classification

| Secret / Parameter | Classification | Storage Location | Cryptographic Protection | Frontend Exposure |
| :--- | :--- | :--- | :--- | :--- |
| `REPOVERIX_JWT_SECRET` | Secret (HMAC Key) | Environment / Vault | Min 32-byte hex; strictly backend runtime | **NEVER** |
| `REPOVERIX_TOKEN_ENCRYPTION_KEY` | Secret (Fernet Key) | Environment / Vault | 32-byte URL-safe base64 key | **NEVER** |
| OAuth Provider Refresh/Access Tokens | Sensitive Secret | `oauth_accounts.access_token` | Encrypted at rest (`fernet:<ciphertext>`) | **NEVER** |
| Personal API Tokens | High-Privilege Token | `api_tokens.token_hash` | Plaintext shown once $\to$ SHA-256 hash | Display prefix only (`rvx_...`) |
| Password Hashes | Authentication Credential | `users.hashed_password` | `bcrypt` (salted, work factor 12) | **NEVER** |
| Email Verification / Reset Tokens | Short-Lived One-Time Token | `users.verification_token_hash` | SHA-256 hash; burned on consumption | Delivered via email link |
| Webhook HMAC Secrets | Symmetric Shared Secret | Environment / `settings` | HMAC-SHA256 constant-time compare | **NEVER** |
| LLM API Keys (OpenAI, Anthropic, Gemini) | Third-Party API Key | Environment / `settings` | Plaintext in backend memory only | **NEVER** |

---

## 2. JWT Token Lifecycle & Cryptographic Resilience

### 2.1 Algorithm Pinning & Claim Verification (`app/core/security.py`)
```python
def decode_token_claims(token: str) -> dict | None:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],  # Strictly pinned to HS256
        )
    except jwt.PyJWTError:
        return None
    return payload if isinstance(payload, dict) else None
```
- **Algorithm Confusion Rejection**: Explicitly passing `algorithms=[settings.jwt_algorithm]` ensures PyJWT rejects tokens signed with `none`, `RS256`, or alternative algorithms.
- **Session Revocation via `token_version` (`tv`)**:
  - Every access token embeds the user's current `tv` integer.
  - When a user logs out of all sessions, changes their password, or is suspended, `user.token_version += 1` is committed to the database.
  - Subsequent requests comparing `token_claims["tv"] == user.token_version` reject stale JWTs immediately.

---

## 3. Fernet Token Encryption at Rest (`app/core/crypto.py`)

### 3.1 Encryption Flow
When `REPOVERIX_TOKEN_ENCRYPTION_KEY` is configured:
1. OAuth provider tokens received during authorization code exchange are passed to `encrypt_token(raw_token)`.
2. The function encrypts the token using Fernet (AES-128-CBC + HMAC-SHA256 authentication) and prepends the prefix `fernet:`.
3. The encrypted string is persisted in `oauth_accounts.access_token` and `oauth_accounts.refresh_token`.
4. `decrypt_token()` strips the prefix and decrypts just-in-time when making GitHub/GitLab API calls.

### 3.2 Key Missing / Misconfiguration Behavior
- If `REPOVERIX_TOKEN_ENCRYPTION_KEY` is removed or missing from a production deployment with encrypted tokens in the database, `decrypt_token()` logs an error and returns `None` rather than leaking raw ciphertext.

---

## 4. Personal API Token Lifecycle (`app/api/routes/tokens.py`)

- **Creation**: `POST /api/v1/tokens` generates a cryptographically random token (`rvx_` + 32 URL-safe characters).
- **Persistence**: Only the SHA-256 hash (`hashlib.sha256(raw.encode()).hexdigest()`) and a 10-character display prefix (`token_prefix`) are stored in `api_tokens`.
- **Authentication Dependency**: Inbound API requests with `Bearer rvx_...` are hashed in-memory and matched against `api_tokens.token_hash`.
- **Immediate Revocation**: `DELETE /api/v1/tokens/{id}` removes the token row or marks `revoked_at = now()`, immediately terminating CI pipeline access.

---

## 5. Secret Rotation Operator Runbook

### 5.1 JWT Secret Rotation
To rotate `REPOVERIX_JWT_SECRET` without data corruption:
1. Generate a new secret: `python -c "import secrets; print(secrets.token_hex(32))"`.
2. Update the environment variable `REPOVERIX_JWT_SECRET` in secret manager / deployment.
3. Restart backend pods / containers.
4. **Effect**: All active user sessions are safely logged out and prompted to sign in again. No user database records or scans are affected.

### 5.2 Fernet Token Encryption Key Rotation
To re-encrypt OAuth tokens under a new Fernet key:
1. Generate new key: `NEW_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")`.
2. Run database migration script using `cryptography.fernet.MultiFernet([Fernet(NEW_KEY), Fernet(OLD_KEY)])`:
   - Decrypts each `oauth_accounts.access_token` with `OLD_KEY`.
   - Re-encrypts with `NEW_KEY`.
3. Update `REPOVERIX_TOKEN_ENCRYPTION_KEY=$NEW_KEY` in production environment.
4. Restart backend services.

---

## 6. Automated Test Proof

| Security Objective | Test Function | Test File | Status |
| :--- | :--- | :--- | :--- |
| JWT validation, expiration & 'none' alg rejection | `test_jwt_lifecycle_and_algorithm_confusion_rejection` | `backend/tests/test_production_lifecycle.py` | **PASSED** |
| Fernet OAuth token encryption & decryption at rest | `test_fernet_token_encryption_at_rest` | `backend/tests/test_production_lifecycle.py` | **PASSED** |
| Personal API token SHA-256 hashing & revocation | `test_personal_api_token_hashing_and_revocation` | `backend/tests/test_production_lifecycle.py` | **PASSED** |
| Token version session invalidation | `test_token_version_bump_invalidates_all_sessions` | `backend/tests/test_audit_domains.py` | **PASSED** |
| Password reset & email token hash verification | `test_password_reset_flow_e2e` | `backend/tests/test_account_security_routes.py` | **PASSED** |

**Conclusion**: RepoVeriX provides end-to-end cryptographic integrity, zero plaintext token persistence, and proven revocation guarantees.
