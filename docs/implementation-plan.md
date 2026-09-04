# RepoVeriX — Implementation Plan

## Environment (inspected)

| Item | Status |
|---|---|
| OS | Windows (Git Bash / MINGW64) |
| Node / npm | v22.23.2 / 10.9.8 |
| Python | 3.12.7 (global), pip 26.2 |
| Docker | 29.5.2 (daemon running) |
| Git | 2.54.0 |
| PostgreSQL client/server | not installed locally (available via Docker Compose) |
| Static tools | ruff 0.16.6 installed; bandit/semgrep absent |
| LLM keys | none configured |

## Workspace state (already present, do not overwrite blindly)

An existing RepoVeriX scaffold:

- `backend/` — FastAPI app with a **complete domain model** (users, repositories, scans,
  analysis_runs, files, symbols, dependencies, findings, evidence, patches,
  verification_runs, test_results), JWT/bcrypt auth, CRUD routes, alembic migration,
  38 passing tests (SQLite in-memory).
- `frontend/` — Next.js 14 App Router + Tailwind + shadcn-style UI: landing, auth,
  dashboard, repositories, scans, findings pages; API client + react-query hooks.
- `docker-compose.yml`, nginx, Dockerfiles, `.env.example`, README.

**Gap:** the CRUD shell exists, but *nothing executes*. A scan is created as a `pending`
row and never runs. There is no ingestion, parsing, static analysis, LLM analysis,
evidence engine, repair generation, or verification. This is the core of RepoVeriX.

## Plan (incremental, tested checkpoints)

1. **Foundation** — git init, `.gitignore`, backend venv, extended settings + structured
   logging, new dependencies (tree-sitter grammars). *(this checkpoint)*
2. **Ingestion** — safe ZIP extraction (path-traversal safe), GitHub shallow clone,
   project detection (languages, package managers, tests, ignores, size limits).
3. **Parser engine** — tree-sitter symbol/import/call extraction for Python, JS, TS with
   a parser abstraction for future languages.
4. **Static analysis** — capability-detected tool adapters (ruff, bandit) + built-in
   deterministic detectors (SQL injection, command injection, hardcoded secrets,
   unsafe eval, weak crypto, bare-except) normalized to one internal finding format.
5. **Knowledge layer** — symbol graph (imports, calls, callers/callees) used to build
   per-candidate LLM context packages; never dump the whole repo into a prompt.
6. **LLM abstraction** — `LLMProvider` protocol with OpenAI/Anthropic providers, a
   `MockProvider` for tests, prompt versioning under `prompts/`, secret redaction,
   structured JSON parsing with retries. No key ⇒ stage fails with a clear message,
   never fake output.
7. **Evidence + validation** — evidence chains (source → transformation → sink →
   static evidence → LLM assessment → validation), deterministic code-grounding
   validation, findings get VERIFIED / PROBABLE / REJECTED with confidence.
8. **Scan orchestrator** — background pipeline persisting per-stage `AnalysisRun` rows;
   branches per configuration (static_only / llm_only / static_llm / repoverix);
   LLM usage + reproducibility metadata recorded per scan.
9. **Frontend wiring** — real ZIP upload, scan start, live polling of stage progress,
   finding detail with evidence chain; verification UI when the engine lands.
10. **Repair + verification** — patch generation, unified diff review, isolated Docker
    sandbox run, tests + static checks + re-analysis, VERIFIED REPAIR outcome.
11. **Benchmark + reporting** — RepoVeriX-Bench (seeded defects), experiment runner for
    the four configurations, precision/recall/F1 metrics (TBD until real runs), scan
    report export (JSON/Markdown).
12. **Docs** — architecture, API, database, pipeline, evidence model, verification,
    security, experiments.

## Engineering decisions (documented)

- **Scan status granularity** is carried by `AnalysisRun` rows (ingestion → parsing →
  static_analysis → knowledge_graph → llm_reasoning → evidence_validation → …) while
  `scan.status` stays coarse (pending/running/completed/failed). The UI renders stage
  progress from real rows — no fake percentages.
- **Repository storage**: per-repository directories under `REPOVERIX_REPOSITORY_STORAGE_DIR`.
  ZIP archives are stored and extracted at scan time; GitHub repos are shallow-cloned at
  scan time. The original never receives patches — verification works on a fresh copy.
- **Static-analysis tools** are optional: built-in deterministic detectors always run;
  ruff/bandit run only when present (capability detection with clear errors).
- **LLM** runs only when a provider key is configured. Tests exercise the full path with
  a deterministic `MockProvider`.
- **Local dev** may use SQLite via `REPOVERIX_DATABASE_URL`; PostgreSQL remains the
  compose/production database.
