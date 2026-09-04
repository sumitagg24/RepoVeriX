# Verification engine

A repair is only trusted after execution. `backend/app/analysis/verify.py`
implements the rule:

> AI proposes a fix; tests + static checks + re-analysis determine whether the
> proposal should be trusted.

## Workflow

```
original working copy (never touched)
        ↓ copy
sandbox: <storage>/<repo_id>/verify/<verification_id>
        ↓ apply unified diff (patchops)
        ↓ static check vs pre-patch baseline (ruff: no NEW issues introduced)
        ↓ run project tests inside an isolated runner (Docker in production)
        ↓ re-analysis: run detectors on the patched file(s)
        ↓ outcome persisted + sandbox deleted
```

Steps in detail:

1. **Isolated copy** — the scan working copy is copied into a per-verification
   sandbox under repository storage. Nothing in the original is modified.
2. **Apply patch** — `patchops.apply_patch_to_directory` parses the unified
   diff, rejects targets that escape the sandbox, and raises a structured
   `PatchError` on the first hunk that does not match. A patch that fails to
   apply → `REPAIR_FAILED`.
3. **Static checks** — ruff (security/bugbear rules) runs on the changed files
   and the result is compared against the **pre-patch baseline**: only
   *newly introduced* issues fail verification. Pre-existing issues elsewhere
   in the repository (e.g. a sibling vulnerability unrelated to this finding)
   do not block a finding-level repair verdict — they are reported in the logs.
4. **Tests in an isolated runner** — production uses `DockerRunner`: the
   sandbox is bind-mounted read-only-ish (`-v host:/workspace`), the container
   gets CPU/memory/time limits, a controlled network
   (`REPOVERIX_SANDBOX_NETWORK`, default `bridge` to allow dependency
   downloads), and **no host secrets or environment**. pytest is installed
   inside the container if missing. `LocalRunner` exists strictly for tests/CI
   (executes host pytest against the sandbox copy). Individual test outcomes
   are parsed from JUnit XML into `TestResult` rows.
5. **Re-analysis** — the built-in detectors run on the patched file. The
   original finding is resolved only when its rule no longer fires inside the
   same function (or, when the function is unknown, near the same lines).
   Tests passing alone never declare success.
6. **Outcome** — the `VerificationRun` and its `Patch` are updated:

| Status | Meaning |
|---|---|
| `verified_repair` | patch applied + tests passed + original finding no longer detected |
| `repair_failed` | patch failed to apply, tests failed, or the defect is still detected |
| `repair_not_verified` | execution could not establish a verdict (runner unavailable, timeout, internal error) |
| `pending` / `running` | lifecycle states |

All steps are recorded in `VerificationRun.logs` and shown in the UI
(execution logs + per-test results).

## Sandbox security

- Execution happens **only** inside Docker with `--network`, `-m`, `--cpus`
  limits and a timeout — never directly on the host.
- The container receives a minimal environment (PATH, CI) — no API keys, no
  `DATABASE_URL`, no host mounts beyond the sandbox directory.
- The sandbox is deleted after the run.

## API

- `POST /api/v1/findings/{id}/generate-fix` — produce a candidate `Patch`
  (deterministic template preferred; LLM fallback only when a provider is
  configured; the diff is validated to apply before it is stored).
- `POST /api/v1/patches/{id}/verify` — create a `VerificationRun` and schedule
  it in the background (test-overridable scheduler seam).
- `GET /api/v1/patches/{id}/verifications`, `GET /api/v1/patches/verification/{id}`
  — run list and detail (with per-test results).

Repair templates live in `repair.py`; they only fire when the code matches an
expected shape exactly and refuse (rather than guess) otherwise. LLM repairs
are validated before acceptance: the patch must reference real files inside the
repository, not be unreasonably large, and must apply cleanly.
