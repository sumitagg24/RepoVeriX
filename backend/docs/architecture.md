# RepoVeriX — Backend Architecture

## Overview

RepoVeriX is a **modular monolith**: all analysis, API, and background work run in a single Python process. The architecture is explicitly designed so the seams for horizontal scaling (task queue, shared rate-limit store, object storage) can be swapped without touching business logic.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Client (Next.js frontend / CI / webhook provider)                     │
└────────────────────┬───────────────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼───────────────────────────────────────────────────┐
│  FastAPI application  (app/main.py)                                    │
│                                                                         │
│  Middleware stack (outermost → innermost):                              │
│    ObservabilityMiddleware  – request ID, access log, Prometheus        │
│    SecurityHeadersMiddleware – HSTS, CSP, X-Frame-Options, …           │
│    CORSMiddleware                                                       │
│    security_middleware (host validation + broad rate-limit)             │
│                                                                         │
│  25 route modules under /api/v1 (see routes/ inventory below)          │
└────────┬───────────────────────────┬───────────────────────────────────┘
         │                           │
┌────────▼──────────┐   ┌────────────▼───────────────────────────────────┐
│  Services layer   │   │  Analysis engine  (app/analysis/)               │
│  app/services/    │   │                                                 │
│                   │   │  orchestrate.py – 8-stage scan pipeline        │
│  billing.py       │   │  ┌─ ingestion (git clone / archive extract)    │
│  access.py        │   │  ├─ parsing (tree-sitter: Python / JS / TS)    │
│  github.py        │   │  ├─ static_analysis (detectors.py)             │
│  gitlab.py        │   │  ├─ knowledge_graph (call-graph builder)       │
│  gh_or_gl.py      │   │  ├─ llm_reasoning (OpenAI / Anthropic / Gemini)│
│  mailer.py        │   │  ├─ evidence_validation (counterexamples)      │
│  oauth.py         │   │  ├─ repair (LLM diff generation)               │
│  reporting.py     │   │  └─ verification (Docker sandbox)              │
│  sarif.py         │   │                                                 │
│  sharing.py       │   │  Subsidiary passes:                            │
│  passwords.py     │   │  pr_audit, intel, health, gitintel, webrun,    │
│  authaudit.py     │   │  changeexplain, testgen, prooffix, vulnmining, │
│  disposable.py    │   │  agents, crosslearn, riskmodel, regression      │
└────────┬──────────┘   └────────────┬───────────────────────────────────┘
         │                           │
┌────────▼───────────────────────────▼───────────────────────────────────┐
│  Database layer  (app/db/)                                              │
│                                                                         │
│  SQLAlchemy 2.0 async ORM  ·  asyncpg (PostgreSQL) / aiosqlite (dev)  │
│  Alembic migrations (9 versions, PostgreSQL-native)                    │
│  init_db() raw-SQL path for SQLite / test environments                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Route Inventory

| Prefix | Module | Feature area |
|--------|--------|--------------|
| `/auth` | auth.py | Email/password signup, login, me, GDPR export, delete |
| `/account-security` | account_security.py | Email verification, password reset/change, security overview, logout |
| `/oauth` | oauth.py | Social login (Google/GitHub/GitLab), repo import, connection mgmt |
| `/onboarding` | onboarding.py | First-run checklist status |
| `/repositories` | repositories.py | Register (URL/archive/zip/OAuth), list, delete |
| `/scans` | scans.py | Create, status, findings, SARIF export, dedup, cancel |
| `/findings` | findings.py | List, detail, generate fix/test, run test, validate, impact, chat, proof-of-fix |
| `/patches` | patches.py | List, quality score, verification runs, trigger sandbox verify |
| `/repositories/.../pull-requests` | pullrequests.py | GitHub PR + GitLab MR audit, post review/note |
| `/pull-requests` | pullrequests.py | Cross-repo PR audit list |
| `/audit` | audit.py | Change audit, evidence graph, attack paths, dep reachability, regression |
| `/intelligence` | intelligence.py | Health+git+wiki+architecture bundle, query, arch smells, health timeline |
| `/research` | research.py | Multi-agent, self-improve, vuln mining, risk model |
| `/learning` | research.py | Cross-repo patterns, validation stats |
| `/automation` | automation.py | Full repair workflow, PR commit status |
| `/billing` | billing.py | Plan overview, Stripe Checkout, portal, webhook, demo activate |
| `/feedback` | feedback.py | Finding verdicts (correct/incorrect/…) |
| `/scans/.../share` | sharing.py | Secret-URL scan shares |
| `/public/reports` | sharing.py | Unauthenticated public report serving |
| `/organizations` | organizations.py | Orgs, members (RBAC), repo attachment, team dashboard |
| `/tokens` | tokens.py | API token create/list/revoke |
| `/webhooks` | webhooks.py | Push webhook receive, secret generate/rotate/delete |
| `/websites` | websites.py | Register website, run passive audit, audit history |
| `/dashboard` | dashboard.py | Aggregated counts summary |

System endpoints (no prefix): `GET /health`, `GET /ready`, `GET /metrics`

---

## Background Task System

All background work runs **in-process** via `asyncio.create_task()`, managed by `app/analysis/runtime.py`.

```
schedule_scan(scan_id, runner)
    └─ schedule(name, coro_factory)
           └─ loop.create_task(_run())
                  ├─ tracked in _tasks[name]
                  ├─ cancellation via _cancel_events[name] (cooperative)
                  └─ cleaned up in finally block
```

**Cancellation** is cooperative: the pipeline checks `runtime.is_cancelled(scan_id)` between stages and exits cleanly. Hard cancellation via `asyncio.Task.cancel()` is available for shutdown.

**Startup recovery** (`app/analysis/recovery.py`): any scan or verification run left in `pending`/`running` state after a crash is reset to `failed` at startup so the UI never shows a stuck job.

### Scaling path

To scale beyond a single process:

1. Replace `schedule_scan` / `schedule` with a task queue submission (Celery + Redis, ARQ, or Dramatiq).
2. Deploy worker processes that import and run the same `run_scan` / `run_verification` / `run_website_audit` coroutines.
3. Set `REPOVERIX_REDIS_URL` so rate limiting is shared across all API workers (the `_AsyncLimiterAdapter` in `ratelimit.py` will automatically use the Redis backend).

No route code changes are needed — the scheduler seam is dependency-injected via `get_scan_scheduler` / `get_verification_scheduler` / `get_website_audit_scheduler` in `app/api/dependencies.py`.

---

## Analysis Pipeline Stages

```
run_scan(session_factory, scan_id)
    │
    ├── 1. ingestion       clone/extract repo → working copy on disk
    ├── 2. parsing         tree-sitter → ParsedFile objects (symbols, calls, imports)
    ├── 3. static_analysis detectors.py → StaticFinding list
    ├── 4. knowledge_graph KnowledgeGraph (call relationships across files)
    ├── 5. llm_reasoning   LLM provider → candidates enriched with caller context
    ├── 6. evidence_validation counterexample battery → VERIFIED / PROBABLE / REJECTED
    ├── 7. repair          LLM diff generation → Patch rows (candidate status)
    └── 8. verification    [async, separate job] Docker sandbox → VerificationRun
```

The `configuration` field on a `Scan` controls which stages run:

| Configuration | Stages |
|---|---|
| `static_only` | 1–4, 6 (no LLM) |
| `llm_only` | 1–2, 5–7 |
| `static_llm` | 1–7 (hybrid) |
| `repoverix` | 1–8 (full pipeline, Pro/Team only) |

---

## LLM Provider Abstraction

`app/analysis/llm.py` defines `_BaseHTTPProvider` with:

- `complete_json(prompt, schema)` — single completion with JSON output
- Configurable timeout, retries, temperature (all from Settings)
- `quarantine_content()` — prompt-injection scrubbing before any user content is sent

Concrete providers: `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`, `MockProvider` (tests).

Selecting a provider: `REPOVERIX_LLM_PROVIDER` = `openai` | `anthropic` | `gemini`.

---

## Artifact Storage

`app/core/artifacts.py` exposes `put(key, data)` / `get(key)` / `delete(key)`:

| `REPOVERIX_ARTIFACT_STORAGE` | Backend |
|---|---|
| `local` (default) | Files under `REPOVERIX_REPOSITORY_STORAGE_DIR` |
| `s3` | Any S3-compatible store via hand-rolled SigV4 (AWS S3, Cloudflare R2, MinIO) |

S3 configuration: `REPOVERIX_ARTIFACT_S3_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY`, `_REGION`, `_ENDPOINT`, `_PREFIX`.

---

## Security Boundary Summary

| Concern | Mechanism |
|---|---|
| Authentication | Stateless JWT (HS256) + SHA-256 hashed API tokens. `token_version` on User makes JWTs revocable. |
| Authorization | `app/services/access.py` — RBAC for org resources; IDOR guard (denials return 404, not 403). |
| Email verification | Required before expensive operations (repo import, scans); enforced by `get_verified_user` dependency. |
| Secrets at rest | OAuth tokens encrypted with Fernet (`REPOVERIX_TOKEN_ENCRYPTION_KEY`). |
| SSRF | `ssrf.py` — resolves hostnames before any outbound fetch; rejects RFC-1918/loopback/link-local/APIPA/cloud-metadata addresses. |
| Rate limiting | Per-IP + per-account fixed windows with exponential backoff; process-local or Redis-backed (see `SECURITY.md`). |
| Sandbox | Docker container with CPU/memory/pids limits and configurable network mode for patch verification. |
| Webhook auth | HMAC-SHA256 (GitHub) / token equality (GitLab) over raw body bytes. |
| Stripe webhook auth | `stripe.Webhook.construct_event` signature verification. |

See `docs/SECURITY.md` for operational hardening, secret rotation, and multi-worker deployment guidance.
