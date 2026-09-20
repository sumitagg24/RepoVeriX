# RepoVeriX — Database Security, Migration & Data Integrity Audit Report

**Audit Target**: RepoVeriX Platform  
**Engine**: PostgreSQL 16 (Managed/Self-Hosted) & SQLite 3 (Test/Local)  
**ORM / Data Layer**: SQLAlchemy 2.0 Async (`AsyncSession`, `selectinload`) + `asyncpg` / `aiosqlite`  
**Migration Framework**: Alembic (`alembic/versions/`)  
**Audit Scope**: Engine & Connection Pooling, Transactions & Race Conditions, Tenant Isolation (BOLA/IDOR), Constraints & Cascades, Schema Migrations, and Data Retention Policies.

---

## 1. Database Architecture & Engine Configuration

### 1.1 Connection Pooling & Resilience (`app/db/database.py`)
- **Engine**: Async engine configured with `pool_pre_ping=True`, `pool_recycle=280`, `pool_size=5`, `max_overflow=10`, `pool_timeout=30`.
- **Managed Provider Hardening (Neon / RDS)**: Managed cloud Postgres pools aggressively sever idle TCP connections. `pool_pre_ping=True` probes connections with a lightweight `SELECT 1` heartbeat before handing them to the request pipeline, eliminating stale connection exceptions ("server closed connection unexpectedly").
- **Session Lifecycle**: Requests bind to a scoped `AsyncSession` via FastAPI `Depends(get_db)`. Sessions default to `expire_on_commit=False` to prevent lazy-load re-queries after commits across async boundaries.

### 1.2 Data Integrity: Primary Keys, Constraints & Types
- **UUID Primary Keys**: All domain entities inherit `UUIDPrimaryKeyMixin` (UUID v4), eliminating sequential integer ID enumeration and cross-tenant collision attacks.
- **Foreign Keys & Cascading Deletes**:
  - `repositories.owner_id -> users.id` (`ondelete="CASCADE"`)
  - `repositories.org_id -> organizations.id` (`ondelete="SET NULL"`)
  - `scans.repository_id -> repositories.id` (`ondelete="CASCADE"`)
  - `findings.scan_id -> scans.id` (`ondelete="CASCADE"`)
  - `evidence.finding_id -> findings.id` (`ondelete="CASCADE"`)
  - `patches.finding_id -> findings.id` (`ondelete="CASCADE"`)
  - `verification_runs.patch_id -> patches.id` (`ondelete="CASCADE"`)
  - `test_results.verification_run_id -> verification_runs.id` (`ondelete="CASCADE"`)
  - `oauth_accounts.user_id -> users.id` (`ondelete="CASCADE"`)
  - `organization_members.organization_id -> organizations.id` (`ondelete="CASCADE"`)
  - `organization_members.user_id -> users.id` (`ondelete="CASCADE"`)
- **Composite Unique Constraints**:
  - `uq_oauth_user_provider`: `(user_id, provider)`
  - `uq_org_member_org_user`: `(organization_id, user_id)`
  - `uq_finding_scan_external`: `(scan_id, external_id)`
  - `uq_auth_webhook_provider_event`: `(provider, event_id)`
  - `uq_finding_feedback_finding_user`: `(finding_id, user_id)`
  - `uq_health_snapshot_repo_commit`: `(repository_id, commit_sha)`

---

## 2. Tenant Isolation & Access Scoping

All resource queries enforce multi-tenant boundaries via the centralized authorization module (`app.services.access`):

```python
# app.services.access.load_repository
async def load_repository(db: AsyncSession, repository_id: uuid.UUID, user_id) -> Repository:
    repo = (await db.execute(select(Repository).where(Repository.id == repository_id))).scalar_one_or_none()
    if repo is None or not await can_read(db, repo, user_id):
        raise AccessDenied("repository_not_found")
    return repo
```

### Access Scope Matrix
- **Personal Repositories**: Scoped strictly to `owner_id == current_user.id`.
- **Organization Repositories**: Membership resolved via `organization_members` join. Read/Scan allowed for role `member`, delete/manage restricted to `admin` / `owner`.
- **Zero IDOR Information Leakage**: Unauthorized requests receive a uniform HTTP 404 ("Not Found") rather than 403 ("Forbidden"), preventing attackers from confirming whether a private repository or scan ID exists.

---

## 3. Transaction Safety & Race Condition Defenses

1. **Scan Creation & Idempotency**:
   - Clients supply an `Idempotency-Key` header.
   - The route queries `Scan.idempotency_key == key` within the user's scope before adding a new scan.
   - If an in-flight duplicate arrives, the existing scan is returned without scheduling a second background job.
2. **Repository Upload Failure Rollback**:
   - In `POST /repositories/zip`, if size caps exceed or magic byte check fails, `await db.delete(repository)` and `dest.unlink()` execute before raising HTTP errors, preventing orphaned database records.
3. **Account Deletion Atomicity (`DELETE /auth/me`)**:
   - Explicitly deletes dependent non-ORM-cascaded items (`ValidationRun`, `GeneratedTest`, `HealthSnapshot`, `ChangeAudit`, `PullRequestAudit`), unlinks on-disk repository directories under `/data/repositories`, purges S3 artifacts, and removes the `User` record in a single transaction.

---

## 4. Schema Migrations (`alembic/`)

- **State Management**: Alembic manages table versions via `alembic/versions/`.
- **Zero Data Loss**: Migrations use nullable column additions (`ADD COLUMN IF NOT EXISTS`) and backfill scripts for non-destructive updates.
- **Rollback Capability**: Alembic upgrade/downgrade chains maintain consistent DDL operations across versions.

---

## 5. Data Retention Policy

| Entity | Retention Duration | Cleanup Mechanism |
|---|---|---|
| **Repositories** | Indefinite (until user deletion) | Cascading delete on user/repo deletion |
| **Scans & Findings** | Indefinite (historical security timeline) | Cascades on repository deletion |
| **OAuth Tokens** | Indefinite while connected | Deleted on account disconnection / user deletion |
| **Auth Audit Events** | 90 days / indefinite compliance | Scrubbed of credentials; retained on user delete for audit integrity |
| **Verification Sandboxes** | Ephemeral | Containers terminated and removed immediately after run (`--rm`) |
| **Temporary Files** | Immediate | Scrubbed on completion/failure in `finally` blocks |
