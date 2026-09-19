# RepoVeriX — Production Infrastructure, Deployment & Environment Security Audit Report

**Date**: September 2026  
**Target Repository**: `sumitagg24/RepoVeriX`  
**Auditor**: Senior Principal Infrastructure & Application Security Architect  
**Scope**: Docker container configurations, multi-container orchestration (`docker-compose.prod.yml`, `docker-compose.vps.yml`), reverse proxy & TLS termination (Caddy), non-root execution, privilege boundaries, network segmentation, HTTP security headers, database pooling, startup reconciliation, and health/readiness separation.  
**Canonical Frontend**: `frontend-2/`  

---

## Executive Summary

RepoVeriX is engineered as a secure, containerized, multi-engine repository security analysis platform. This audit evaluated the production infrastructure topology, runtime isolation flags, secret boundary controls, network segmentation, and service lifecycle resilience.

### Key Infrastructure Findings:
- **Container Hardening**: Backend (`backend/Dockerfile`) and frontend (`frontend-2/Dockerfile`) containers run strictly as unprivileged non-root users (`repoverix` uid/gid 1000/1000, `nextjs` uid/gid 1001/1001).
- **Network Segmentation**: Internal services (PostgreSQL, Redis, background runners) reside on an isolated bridge network (`repoverix`) with no exposed public ports when deployed behind Caddy or a managed reverse proxy.
- **Fail-Closed Configuration**: `app/core/config.py::ensure_production_safety` prevents booting with default `jwt_secret`, unconfigured email backends (`console`), or invalid Fernet cryptographic keys.
- **Health vs. Readiness Separation**: Liveness probe (`/health`) answers instantly without database load; readiness probe (`/ready`) validates database connectivity via `SELECT 1` and returns HTTP 503 (`{"status": "not_ready"}`) without leaking internal connection strings or stack traces when the database is unavailable.
- **Startup Resilience**: `app/analysis/recovery.py` automatically scans the database at boot to reconcile stale `pending`/`running` jobs from prior crashes or restarts into honest terminal states (`failed` / `repair_not_verified`).

---

## 1. Production Topology & Deployment Inventory

```mermaid
flowchart TD
    subgraph Public Internet
        ClientBrowser[Browser Client (HTTPS)]
        GitWebhook[GitHub / GitLab Webhook]
    end

    subgraph Edge / Reverse Proxy Layer
        Caddy[Caddy 2.x Reverse Proxy / TLS Auto-ACME]
    end

    subgraph Internal Network: repoverix
        NextJS[Canonical Frontend: frontend-2 (Node 20 Alpine / nextjs:1001)]
        FastAPI[Backend API: FastAPI (Python 3.12 / repoverix:1000)]
        Postgres[(PostgreSQL 16 Alpine / Neon Pooled DB)]
        
        subgraph Disposable Execution Sandboxes
            DockerDaemon[Host Docker Daemon Socket]
            DockerSandbox[Disposable Sandbox Container: python:3.12-slim / node:20-slim]
        end
    end

    subgraph External Cloud Providers
        OAuthProviders[OAuth: GitHub, Google, GitLab, Auth0, Microsoft, Oracle]
        LLMProviders[LLM APIs: OpenAI, Anthropic, Gemini]
        S3Storage[Object Storage: S3 / Cloudflare R2 / MinIO]
    end

    ClientBrowser -->|HTTPS :443| Caddy
    GitWebhook -->|HTTPS :443| Caddy
    Caddy -->|HTTP :3000| NextJS
    Caddy -->|HTTP :8000| FastAPI
    NextJS -->|Same-Origin Proxy /api/v1/*| FastAPI
    FastAPI -->|AsyncPG / TLS pool_pre_ping| Postgres
    FastAPI -.->|Restricted Exec / Isolated Tempdir| DockerDaemon
    DockerDaemon -->|--cap-drop ALL, --pids-limit 256| DockerSandbox
    FastAPI -->|Egress TLS| OAuthProviders
    FastAPI -->|Egress TLS| LLMProviders
    FastAPI -->|Egress TLS| S3Storage
```

### 1.1 Infrastructure Component Inventory

| Component | Image / Runtime | User / Privilege | Network Boundary | Storage / Volumes |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** (`frontend-2`) | `node:20-alpine` (Next.js 14) | `nextjs` (UID 1001) | Internal `repoverix` (:3000) | Ephemeral container FS |
| **Backend API** | `python:3.12-slim` (FastAPI) | `repoverix` (UID 1000) | Internal `repoverix` (:8000) | `/data/repositories` (Named Volume) |
| **Database** | `postgres:16-alpine` | `postgres` (UID 70) | Internal `repoverix` (:5432) | `pgdata` (Persistent Volume) |
| **Edge Proxy** | `caddy:2-alpine` | `caddy` (UID 100) | Public :80, :443 $\to$ Internal | `caddy_data`, `caddy_config` |
| **Proof-of-Fix Sandbox** | `python:3.12-slim` / `node:20-slim` | Root in user-ns / `nobody` | `bridge` / `none` (isolated) | Bind mount of isolated temporary copy |

---

## 2. Container Production Hardening Audit

### 2.1 Backend Container (`backend/Dockerfile`)
1. **Multi-Stage & Clean Layers**:
   - Downloads static Docker CLI binary for in-container runner operations without pulling full docker engine suites.
   - Cleans `/var/lib/apt/lists/*` and temporary tarballs in single RUN instructions.
   - `pip install --no-cache-dir . ruff` ensures minimal image footprint.
2. **Non-Root Execution**:
   - Creates explicit system group and user `repoverix`:
     ```dockerfile
     RUN groupadd -r repoverix && useradd -r -g repoverix repoverix \
         && mkdir -p /data/repositories \
         && chown -R repoverix:repoverix /data /app
     USER repoverix
     ```
3. **Built-in Healthcheck**:
   - `HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3` queries `/health` locally via Python `urllib.request`.

### 2.2 Frontend Container (`frontend-2/Dockerfile`)
1. **Multi-Stage Build**:
   - `builder` stage installs dependencies (`npm ci --legacy-peer-deps`) and compiles Next.js production build (`npm run build`).
   - `runner` stage inherits only compiled `.next`, `node_modules`, `package.json`, and `public`.
2. **Non-Root Execution**:
   - Runs as dedicated `nextjs:1001` user (`addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs`).
3. **Source Map & Information Leak Suppression**:
   - `productionBrowserSourceMaps: false` in `next.config.mjs` prevents leaking React component source trees to browser developer tools.
   - `poweredByHeader: false` suppresses `X-Powered-By: Next.js`.

---

## 3. Network Segmentation & Trust Boundaries

### 3.1 Reverse Proxy & Client Header Trust
- In `backend/app/core/config.py`:
  - `trust_proxy_headers: bool = False` (default). When deployed directly or in test environments, client-supplied `X-Forwarded-For` is ignored to prevent IP spoofing for rate limits.
  - When deployed behind Caddy or AWS ALB, setting `REPOVERIX_TRUST_PROXY_HEADERS=true` instructs `app/core/ratelimit.py` to extract the true client IP from the outermost proxy header.
- In `Caddyfile`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `request_body { max_size 4MB }` blocks HTTP request flooding at the edge.

### 3.2 Host Header Validation (`reject_untrusted_host`)
- `app/middleware/security.py` verifies the HTTP `Host` header against `REPOVERIX_ALLOWED_HOSTS`:
  - Any request with an unrecognized `Host` (e.g., attacker domain targeting password reset link generation) is rejected with **HTTP 403 Forbidden**.
  - Verified in automated test `test_security_headers_and_untrusted_host_rejection`.

---

## 4. Database & Redis Production Configuration

### 4.1 PostgreSQL Connection Pool & Lifecycle
- `create_async_engine` parameters in `app/db/database.py`:
  - `pool_pre_ping=True`: Probes connections before reuse, surviving serverless database cold-starts and connection drops (e.g. Neon, AWS Aurora).
  - `pool_recycle=280`: Recycles connections before typical 300s TCP keepalive dropouts.
  - `pool_size=5`, `max_overflow=10`, `pool_timeout=30`: Prevents database connection exhaustion under spike loads.

---

## 5. Startup & Shutdown Failure Mode Analysis

| Failure Scenario | System Behavior | Mitigation & Safety Mechanism |
| :--- | :--- | :--- |
| **Backend crash mid-scan** | Interrupted scan rows remain `running` | On startup, `recover_stale_jobs` marks all `pending`/`running` scans as `failed` with descriptive retry guidance. |
| **Database unreachable at boot** | Backend cannot execute startup migration | Startup continues gracefully; `/health` reports alive, `/ready` answers HTTP 503 (`{"status": "not_ready"}`), avoiding crash loops. |
| **Docker daemon down** | Proof-of-Fix verification cannot spawn container | `DockerRunner.run_tests` returns honest runner error (`"Docker is not available"`) without crashing the application. |
| **SIGTERM / Graceful Shutdown** | Active HTTP requests drain | ASGI server stops accepting new connections; in-process tasks are signalled to finish or caught by recovery upon restart. |

---

## 6. Automated Test Verification

| Test Target | Test Function | Test File | Result |
| :--- | :--- | :--- | :--- |
| Liveness & Readiness Separation | `test_health_and_readiness_endpoints` | `backend/tests/test_production_lifecycle.py` | **PASSED** |
| Stale Job Startup Reconciliation | `test_startup_recovery_reconciles_interrupted_jobs` | `backend/tests/test_production_lifecycle.py` | **PASSED** |
| Security Headers & Untrusted Host Rejection | `test_security_headers_and_untrusted_host_rejection` | `backend/tests/test_production_lifecycle.py` | **PASSED** |

---

## 7. Production Deployment Checklist

- [x] Set strong `REPOVERIX_JWT_SECRET` (at least 32 bytes random hex).
- [x] Configure `REPOVERIX_TOKEN_ENCRYPTION_KEY` using `cryptography.fernet.Fernet.generate_key()`.
- [x] Set `REPOVERIX_EMAIL_BACKEND=smtp` with valid TLS SMTP credentials.
- [x] Configure `REPOVERIX_ALLOWED_HOSTS` with production domain names (`api.repoverix.com`, etc.).
- [x] Ensure `productionBrowserSourceMaps: false` in `frontend-2/next.config.mjs`.
- [x] Restrict PostgreSQL port 5432 to internal docker network.
- [x] Configure reverse proxy with Let's Encrypt TLS and HSTS.
