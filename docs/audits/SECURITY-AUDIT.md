# RepoVeriX — Comprehensive Production Security & Architecture Audit Report

**Audit Target**: RepoVeriX Platform  
**Version**: `v0.2.1`  
**Canonical Frontend**: `frontend-2/`  
**Backend**: FastAPI + SQLAlchemy (Async) + PostgreSQL  
**Audit Scope**: OAuth 2.0/PKCE, SSRF, Multi-Tenant Authorization (BOLA/BFLA), Git Ingestion, Sandbox Isolation, LLM Security, Credential Redaction, Rate Limiting, CI/CD, Frontend Security, SEO/AEO/GEO.

---

## 1. Executive Summary

A comprehensive, defense-in-depth security audit and hardening pass was conducted across the RepoVeriX codebase. All external inputs—including repository source code, Git URLs, archive uploads, OAuth provider callbacks, and LLM completions—are treated as strictly untrusted.

### Core Security Principles Enforced
1. **Zero-Trust Input Model**: All repository files, commit messages, and URLs are treated as potentially hostile.
2. **Canonical Frontend Integrity**: `frontend-2/` is the sole canonical production frontend.
3. **No Direct Execution on Host**: Untrusted repositories and candidate repair patches are only built and tested inside disposable, resource-capped containers (`--cap-drop ALL`, `--pids-limit`, `--security-opt no-new-privileges`).
4. **Centralized Credential Redaction**: All embedded tokens, userinfo URLs, and passwords are automatically redacted before reaching logs, error messages, or exception traces.
5. **Robust SSRF Defense**: Double-layered preflight resolution with connection pinning against DNS rebinding, private CIDR filtering, and IPv4-mapped IPv6 normalization.

---

## 2. Threat Model & Scope

| Threat Vector | Potential Impact | RepoVeriX Defense |
|---|---|---|
| **Malicious Repository Ingestion** | Remote Code Execution via Git hooks, fsmonitor, or submodules | Git executed with `-c core.hooksPath=/dev/null`, `-c protocol.ext.allow=never`, `-c core.fsmonitor=false`, and `GIT_TERMINAL_PROMPT=0`. |
| **SSRF via Clone / Archive / Crawl** | Intranet scanning, cloud metadata access (`169.254.169.254`) | Preflight resolution, connection pinning (`PinPlan`), scheme whitelisting (`http`/`https` only), and blocked network validation covering IPv4, IPv6, and `::ffff:` mapped addresses. |
| **Zip Slip / Decompression Bombs** | Arbitrary file overwrite, disk/inode exhaustion | PurePosixPath canonicalization, `is_relative_to` root checks, per-member size limits, total size limits, and `max_files` count limits. |
| **OAuth Hijacking / Login CSRF / Open Redirects** | Account takeover, code interception, phishing redirects | Cryptographically random single-use state cookies, RFC 7636 PKCE (`S256`), constant-time state verification (`compare_digest`), and strict same-origin `next` path sanitization. |
| **Dynamic Tenant Domain Manipulation** | SSRF to internal identity brokers | `assert_safe_url` validation on configured `auth0_domain` and `oracle_idcs_url` before URL construction. |
| **Multi-Tenant BOLA / IDOR** | Cross-tenant data leakage | Centralized authorization layer (`app.services.access`) returns uniform 404s without leaking entity existence. |
| **LLM Prompt Injection in Code** | System prompt leakage, fake findings | Instruction-hierarchy system prompt hardening (`harden_system`) and untrusted content quarantine delimiters (`quarantine_content`). |
| **Sandbox Breakout during Repair Verification** | Host compromise during test execution | Docker execution with `--cap-drop ALL`, `--pids-limit`, `--security-opt no-new-privileges`, memory and CPU limits, and clean environment sanitization. |

---

## 3. OAuth 2.0 & Identity Provider Matrix

Seven OAuth providers are natively supported with server-side capability reporting, dedicated local SVG branding, and PKCE protection:

| Provider | Sign-In | Repo Import | PKCE / Protocol | Endpoint Config |
|---|---|---|---|---|
| **GitHub** | ✅ | ✅ | OAuth 2.0 (`read:user repo`) | `api.github.com` |
| **GitLab** | ✅ | ✅ | OAuth 2.0 (`read_user read_api`) | `gitlab.com` |
| **Google** | ✅ | ❌ | OpenID Connect / OAuth 2.0 | `accounts.google.com` |
| **Microsoft** | ✅ | ❌ | Microsoft Graph v2.0 | `login.microsoftonline.com` |
| **Bitbucket** | ✅ | ✅ | OAuth 2.0 (`account repository`) | `bitbucket.org` |
| **Auth0** | ✅ | ❌ | Dynamic OIDC (`openid profile email`) | Configured via `REPOVERIX_AUTH0_DOMAIN` (SSRF validated) |
| **Oracle** | ✅ | ❌ | Oracle IDCS / IAM OAuth 2.0 | Configured via `REPOVERIX_ORACLE_IDCS_URL` (SSRF validated) |

---

## 4. Frontend Security & Architecture (`frontend-2/`)

### Key Protections
- **Same-Origin API Proxy** (`src/app/api/v1/[...path]/route.ts`): Browser talks solely to its own origin; tokens never cross origins or require preflight compromises.
- **Strict Headers** (`next.config.mjs`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- **Zero Raw HTML Injection**: `dangerouslySetInnerHTML` is restricted to immutable build-time JSON-LD structured data and theme bootstrap scripts.
- **Icon Security**: All brand icons for all 7 OAuth providers are packaged as local inline SVG components (no third-party external CDN requests).

---

## 5. SEO, AEO, and GEO Architecture

- **Sitemap**: Dynamic Next.js `/sitemap.xml` (`frontend-2/src/app/sitemap.ts`) indexes all public product, solution, documentation, and pricing pages with weighted priorities.
- **Robots Directives**: `frontend-2/src/app/robots.ts` disallows search bot traversal of private authenticated zones (`/dashboard`, `/repositories`, `/scans`, `/findings`, `/settings`, `/auth`).
- **Structured Data**: Root layout (`frontend-2/src/app/layout.tsx`) embeds Schema.org JSON-LD graph (`Organization`, `WebSite`, `SoftwareApplication`).

---

## 6. Automated Security Regression Testing

A dedicated test suite (`backend/tests/test_security_regression.py`) enforces:
1. `test_ssrf_blocks_private_and_metadata_ips`
2. `test_ssrf_rejects_dangerous_non_http_schemes`
3. `test_ssrf_permits_public_fqdns`
4. `test_redact_url_userinfo_and_tokens`
5. `test_redact_string_in_command_output`
6. `test_pkce_generation_and_challenge`
7. `test_sanitize_next_path_prevents_open_redirects`
8. `test_dynamic_tenant_ssrf_guards`
9. `test_extract_archive_blocks_zip_slip`
10. `test_user_cannot_access_other_user_repository`
