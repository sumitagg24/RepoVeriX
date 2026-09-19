# RepoVeriX — Background Job, Queue & Worker Security Audit Report

**Audit Target**: Background Execution & Orchestration Engine  
**Core Modules**: `app/analysis/runtime.py`, `app/analysis/orchestrate.py`, `app/analysis/ingest.py`, `app/analysis/verify.py`  
**Audit Scope**: Asynchronous Task Tracking, Job Authorization, Worker Isolation, Retry & Idempotency Controls, and Execution Timeouts.

---

## 1. Background Task Inventory

| Operation | Trigger | Scheduling Mechanism | Worker/Runtime | Timeout | Isolation Boundary |
|---|---|---|---|---|---|
| **Repository Clone / Ingest** | Scan creation / Webhook | `schedule_scan` | In-process Asyncio worker (`app.analysis.orchestrate`) | 300s (`git_clone_timeout_seconds`) | Isolated per-repo directory `/data/repositories/{id}/source` |
| **AST Parsing & Static Analysis** | Scan pipeline stage | Stage orchestrator | In-process Python/Tree-sitter | Step timeout | Read-only scan on working copy |
| **LLM Reasoning & Fix Synthesis** | Pipeline stage | Stage orchestrator | Async HTTP client to provider endpoint | 120s (`llm_timeout_seconds`) | Quarantined context; prompt injection delimiter guards |
| **Proof-of-Fix Verification** | Scan pipeline stage / Repair API | Docker verification runner | Container sandbox | 600s (`sandbox_timeout_seconds`) | Disposable container, `--cap-drop ALL`, `--pids-limit 256`, memory cap `1g` |
| **Passive Website Crawl** | Website audit API | Async crawler task | In-process HTTP client | 300s | Restricted passive GET requests only |

---

## 2. Job Authorization & Tenant Boundaries

1. **Job Creation Gate**:
   - `POST /scans` requires verified user authentication (`Depends(get_verified_user)`).
   - Before scheduling, the repository is resolved via `Repository.id == payload.repository_id AND Repository.owner_id == current_user.id`.
   - Users cannot schedule tasks or trigger pipeline operations on other tenants' repositories.
2. **Cancellation Authorization**:
   - `POST /scans/{id}/cancel` verifies repository ownership before invoking `runtime.request_cancel(scan_id)`.
   - Cancellation sets an `asyncio.Event` flag; workers check `is_cancelled(scan_id)` at every stage boundary and terminate gracefully without leaving partial zombie runs.

---

## 3. Worker Isolation & Sandbox Containment

- **Ephemeral Directory Isolation**: Each repository's source code and archive exist only within `/data/repositories/{repo_id}/`. File operations resolve strictly within this path.
- **Docker Verification Sandbox**:
  - Verification containers execute candidate patches in an isolated container instance with `--cap-drop ALL`, `--security-opt no-new-privileges`, and strict resource limits (`1.0 CPU`, `1g RAM`, `256 PIDs`).
  - Host files are never mounted with write permissions.
- **No Shared Mutable State**: Scans operate on isolated clones. Patches are generated as unified diffs in memory and applied only in disposable verification environments.

---

## 4. Idempotency & Runaway Retries

- **Client Idempotency**: Scan requests with `Idempotency-Key` return the existing `Scan` record instead of spawning concurrent worker tasks.
- **LLM Rate Caps & Limits**:
  - `llm_max_retries = 2`
  - `llm_max_candidates_per_scan = 60`
  - `llm_max_context_chars = 24000`
- **Watchdog Timeouts**: All network calls, Git operations, LLM synthesis requests, and container runs have explicit timeout envelopes, preventing hung tasks or thread exhaustion.
