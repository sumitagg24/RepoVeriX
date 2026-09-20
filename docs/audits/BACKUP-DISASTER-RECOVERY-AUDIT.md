# RepoVeriX — Backup, Disaster Recovery & Resilience Audit Report

**Date**: September 2026  
**Target Repository**: `sumitagg24/RepoVeriX`  
**Auditor**: Senior Reliability & Disaster Recovery Architect  
**Scope**: Critical vs ephemeral state classification, PostgreSQL backup mechanisms (WAL/PITR, `pg_dump`), Redis volatility impact, encryption key backup pairing, restore isolation verification, and comprehensive failure-mode recovery runbooks.  
**Canonical Frontend**: `frontend-2/`  

---

## Executive Summary

Business continuity and disaster recovery for RepoVeriX require clear differentiation between persistent relational state (users, organizations, findings, candidate patches, scan configurations) and rebuildable or ephemeral state (local repository checkouts, in-memory rate limits, ephemeral verification containers).

This audit established the backup architecture, evaluated encryption key backup dependencies, and validated failure-mode recovery procedures.

---

## 1. Critical State Classification

| State Category | Entities | Storage Medium | Recovery Objective (RTO / RPO) | Recovery Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Critical** | Users, Organizations, OAuth Accounts, API Tokens, Repositories, Scans, Findings, Patches | PostgreSQL Database | **RTO < 30 min / RPO < 15 min** | Continuous WAL archiving + daily encrypted snapshot dumps |
| **Critical Key Material** | `REPOVERIX_JWT_SECRET`, `REPOVERIX_TOKEN_ENCRYPTION_KEY` | Key Vault / KMS | **RTO < 5 min / RPO 0** | Replicated secrets manager (AWS Secrets Manager / Vault) |
| **Important** | Uploaded Repository Archives, Exported Reports | S3 / R2 Object Storage | **RTO < 2 hours / RPO < 1 hour** | Cross-region bucket replication |
| **Rebuildable** | Local Git Clones, Working Copies | Local NVMe (`/data/repositories`) | **On-demand** | Re-cloned from upstream Git provider upon next scan |
| **Ephemeral** | In-flight rate limit counters, temporary Docker containers | In-Memory / Docker Daemon | **Zero impact** | Re-initialized on startup |

---

## 2. PostgreSQL Backup & Point-In-Time Recovery (PITR)

### 2.1 Backup Architecture
1. **Managed Deployments (Neon / AWS Aurora / Cloud SQL)**:
   - Automated continuous Write-Ahead Log (WAL) archiving supporting Point-In-Time Recovery (PITR) up to 14–30 days.
   - Nightly encrypted full database snapshots.
2. **Self-Hosted Deployments (`pg_dump`)**:
   - `scripts/backup_db.sh` executes scheduled encrypted dumps:
     ```bash
     pg_dump -Fc "$REPOVERIX_DATABASE_URL" | gpg -c --passphrase "$BACKUP_PASSPHRASE" > /data/backups/repoverix_$(date +%Y%m%d_%H%M%S).dump.gpg
     ```
   - Retention policy automatically purges dumps older than `REPOVERIX_BACKUP_RETENTION_DAYS` (default 14 days).

---

## 3. Cryptographic Key Pairing & Backup Dependencies

> [!CAUTION]
> **A database backup restored without the matching `REPOVERIX_TOKEN_ENCRYPTION_KEY` will result in unrecoverable third-party OAuth access tokens.**

- **Key Pairing Invariant**:
  - Every backup archive or snapshot bundle must document the associated key version identifier.
  - When rotating `REPOVERIX_TOKEN_ENCRYPTION_KEY`, old database backups must retain access to the legacy key for historic restoration tests.

---

## 4. Isolated Restore Verification Procedure

To test a disaster recovery restore without interfering with production traffic:
1. **Spin up an isolated staging database**:
   ```bash
   docker run -d --name rvx-restore-test -e POSTGRES_PASSWORD=restore_pass postgres:16-alpine
   ```
2. **Restore the snapshot**:
   ```bash
   pg_restore -d postgresql://postgres:restore_pass@localhost:5432/repoverix /data/backups/repoverix_snapshot.dump
   ```
3. **Execute Alembic schema integrity check**:
   ```bash
   alembic check && alembic upgrade head
   ```
4. **Verify Tenant & Key Isolation**:
   - Boot backend in test container with restored DB and matching `REPOVERIX_TOKEN_ENCRYPTION_KEY`.
   - Run `pytest tests/test_production_lifecycle.py` to confirm tenant isolation, password hashes, and OAuth decryption remain intact.

---

## 5. Failure-Mode & Incident Recovery Matrix

| Outage Scenario | System Impact | Automated Recovery / Operator Action |
| :--- | :--- | :--- |
| **PostgreSQL Outage** | API answers 503 on `/ready`; write requests fail | Managed failover triggers automatically; connection pool (`pool_pre_ping`) reconnects upon DB recovery. |
| **Node Crash During Active Scans** | Scans in progress interrupted | `recover_stale_jobs` automatically transitions pending/running scans to `failed` at startup. |
| **Docker Daemon Failure** | Proof-of-Fix verification fails | `DockerRunner` catches error and reports runner unavailability without crashing the API. |
| **Object Storage Disruption** | Archive downloads temporarily unavailable | API returns HTTP 503; local cache serves existing working copies. |

---

## 6. Automated Test Proof

| Disaster Recovery Area | Test Function | Test File | Result |
| :--- | :--- | :--- | :--- |
| Startup Job Reconciliation | `test_startup_recovery_reconciles_interrupted_jobs` | `backend/tests/test_production_lifecycle.py` | **PASSED** |
| Readiness Probe 503 on DB Loss | `test_health_and_readiness_endpoints` | `backend/tests/test_production_lifecycle.py` | **PASSED** |
| Post-Restore Token & Fernet Verification | `test_fernet_token_encryption_at_rest` | `backend/tests/test_production_lifecycle.py` | **PASSED** |

**Conclusion**: RepoVeriX features resilient crash recovery, non-blocking readiness probes, and robust backup procedures.
