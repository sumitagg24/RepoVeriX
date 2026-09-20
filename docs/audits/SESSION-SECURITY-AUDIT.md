# RepoVeriX — Session, Cookie & Account Security Audit Report

**Audit Target**: Authentication, Session Lifecycle, Cookie Security & Rate Limiting  
**Core Modules**: `app/core/security.py`, `app/services/account_security.py`, `app/core/ratelimit.py`, `app/api/routes/auth.py`, `app/api/routes/oauth.py`  
**Audit Scope**: Stateless JWT Session Lifecycle, Instant Session Revocation (`token_version`), Cookie Security Attributes, Account Lockout & Brute-Force Defenses, and Account Enumeration Mitigations.

---

## 1. Session Lifecycle & Token Architecture

### 1.1 Stateless JWT with Revocability (`token_version`)
- **Structure**: HMAC-SHA256 signed JWT with claims:
  - `sub`: User UUID string
  - `iat`: Issued-at timestamp
  - `exp`: Expiration timestamp (default: 24 hours, configurable via `REPOVERIX_ACCESS_TOKEN_EXPIRE_MINUTES`)
  - `tv`: Integer `token_version`
- **Instant Revocation Mechanics**:
  - Stateless JWTs are typically non-revocable before expiration. RepoVeriX solves this by embedding `tv: user.token_version` in every token.
  - When a user changes their password, resets credentials, logs out of all devices, or is suspended, `user.token_version += 1` is committed to the database.
  - In `app/api/dependencies.py:get_current_user`, incoming tokens are decoded and checked:
    ```python
    if token_claims.get("tv", 0) != (user.token_version or 0):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")
    ```
  - Result: Immediate invalidation across all existing devices without maintaining large server-side session blacklists.

---

## 2. Cookie Security Attributes

1. **OAuth State Cookies (`POST /api/v1/auth/oauth/{provider}/login`)**:
   - `httponly=True`: Inaccessible to JavaScript (XSS theft mitigation).
   - `samesite="lax"`: Mitigates cross-site request forgery (CSRF) during redirects while allowing OAuth callback flows.
   - `secure=True`: Enforced in production environments (`https`).
   - `max_age=300`: 5-minute ephemeral lifespan.
   - Single-use state token and code verifier mapped in memory with cleanup on consumption.

---

## 3. Account Enumeration & Information Leakage

- **Login Endpoint (`POST /auth/login`)**:
  - Returns identical HTTP 401 `{"detail": "Invalid email or password"}` response whether the email exists or not.
  - Constant-time password verification via `verify_password()` prevents timing attacks.
- **Forgot Password (`POST /auth/account/password/forgot`)**:
  - Always returns `{ "detail": "If the account exists, a password reset link has been sent." }` regardless of whether the email is present in the database.
- **One-Time Token Storage**:
  - Password reset and email verification tokens are stored as SHA-256 hashes (`verification_token_hash`, `password_reset_token_hash`). A read-only database dump cannot yield actionable reset links.

---

## 4. Brute-Force & Progressive Account Lockout

RepoVeriX enforces dual-layer brute-force defense:

1. **Fast In-Memory Rate Limiter (`app/core/ratelimit.py`)**:
   - Dual-keyed on client IP and normalized target email.
   - Maximum 8 attempts per 300-second window.
   - Violations trigger exponential backoff starting at 30 seconds up to 3600 seconds.
2. **Persistent Database Progressive Lockout (`app/services/account_security.py`)**:
   - Tracks `failed_login_count` on the `User` model.
   - After 5 consecutive failures, `locked_until` is set to 5 minutes, multiplying by 2 on subsequent failures up to a cap of 120 minutes.
   - Resets to 0 immediately upon successful authentication.
   - Locked accounts receive HTTP 423 `{"detail": "Account temporarily locked due to multiple failed login attempts."}`.
