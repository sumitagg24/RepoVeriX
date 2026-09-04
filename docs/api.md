# API

Base path: `/api/v1` (see `REPOVERIX_API_PREFIX`). Interactive docs at
`/docs`. Every endpoint except auth requires `Authorization: Bearer <token>`.

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | create account → `{access_token, token_type}` |
| POST | `/auth/login` | login → `{access_token, token_type}` |
| GET | `/auth/me` | current user |

## Repositories

| Method | Path | Description |
|---|---|---|
| POST | `/repositories` | register GitHub repo `{name, source_type: github, source_url, default_branch}` |
| POST | `/repositories/zip` | multipart upload `name` + `file` (.zip); archive validated & stored |
| GET | `/repositories` | list owned repositories |
| GET | `/repositories/{id}` | repository detail |
| DELETE | `/repositories/{id}` | delete repo + stored files (204) |

## Scans

| Method | Path | Description |
|---|---|---|
| POST | `/scans` | start scan `{repository_id, configuration}` → 201 (background execution) |
| GET | `/scans` | list scans (filter `repository_id`) |
| GET | `/scans/{id}` | scan detail with `analysis_runs` |
| GET | `/scans/{id}/findings` | findings of the scan (filters `severity`, `status`) |
| POST | `/scans/{id}/cancel` | cooperative cancel of a pending/running scan |
| GET | `/scans/{id}/report?format=json\|markdown` | full audit report (JSON object or downloadable Markdown) |

`configuration` ∈ `static_only` | `llm_only` | `static_llm` | `repoverix`.

## Findings

| Method | Path | Description |
|---|---|---|
| GET | `/findings` | list (filters: `scan_id`, `repository_id`, `category`, `severity`, `status`) |
| GET | `/findings/{id}` | finding + evidence + patches |
| GET | `/findings/scan/{scan_id}/summary` | aggregated counts by severity/status/category |
| POST | `/findings/{id}/generate-fix` | create a candidate `Patch` (template or LLM); 422 with a readable reason when no repair applies |

## Patches & verification

| Method | Path | Description |
|---|---|---|
| GET | `/patches` | list (filters `finding_id`, `scan_id`, `status`) |
| GET | `/patches/{id}` | patch detail (diff) |
| GET | `/patches/{id}/verifications` | verification runs for the patch |
| POST | `/patches/{id}/verify` | create + schedule a `VerificationRun` (201); 409 if one is already pending/running |
| GET | `/patches/verification/{id}` | verification run detail incl. per-test results |

Verification statuses: `pending`, `running`, `verified_repair`,
`repair_failed`, `repair_not_verified`. Patch statuses: `candidate`,
`applied`, `verified`, `failed`, `not_verified`.

## Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/summary` | repository/scan counts + finding aggregates |

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | liveness |

## Conventions

- UUID ids; Pydantic request/response schemas under `backend/app/schemas/`.
- Errors: plain-text `detail` (or pydantic validation list); 404 on
  ownership/not-found, 409 on conflicts, 422 on unprocessable input.
- The report endpoint returns structured JSON for research workflows and
  Markdown for humans/printing.
