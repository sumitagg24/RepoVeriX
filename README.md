# RepoVeriX

**Evidence-Grounded Repository-Level Code Auditing and Verified Automated Repair**

RepoVeriX is a research prototype that audits whole repositories, produces
findings backed by explicit evidence, generates candidate patches, and — before
anything is trusted — verifies those patches by executing them in an isolated
sandbox.

> **The LLM proposes; evidence and execution verify.**

The system never claims "the AI found a vulnerability, therefore it is real" or
"the AI generated a fix, therefore it is fixed". Findings survive evidence
validation; repairs survive tests, static checks and re-analysis inside Docker.

## Research positioning

RepoVeriX is a research prototype investigating whether combining deterministic
static analysis, repository-level context, LLM reasoning, evidence validation
and execution-based verification improves defect detection and repair
reliability compared with static-only or LLM-only approaches. It is designed to
run the same repositories through four audit configurations
(`static_only`, `llm_only`, `static_llm`, `repoverix`) and compare them on a
controlled benchmark (RepoVeriX-Bench) — see `docs/experiments.md`. Existing
work it builds on and differentiates from includes repository-level code QA
research (e.g. RepoAudit-style systems, CodePlan, automated LLM code review,
classic vulnerability scanners).

## Features

- **Repo ingestion** — GitHub clone or safe ZIP upload (path-traversal and size
  guards), language/package-manager/test detection.
- **Repository knowledge** — tree-sitter parsing of Python/JS/TS with
  symbol/import/call graphs for cross-file context.
- **Deterministic static analysis** — built-in detectors (SQL injection,
  hardcoded secrets, command injection, unsafe eval, weak hashes, ...) plus
  optional ruff/bandit with graceful capability detection.
- **Evidence-grounded findings** — every finding carries an ordered evidence
  chain (source → transformation → sink → static analysis → LLM reasoning) and
  a VERIFIED / PROBABLE / REJECTED status; LLM claims without grounding are
  rejected.
- **Verified automated repair** — deterministic patch templates first, LLM
  repair fallback, then **Docker-sandboxed verification**: patch applied → tests
  run → ruff baseline check → original finding re-analysed → `VERIFIED REPAIR`
  or `REPAIR_FAILED`.
- **Audit reports** — JSON and Markdown reports per scan.
- **Benchmark framework** — seeded vulnerable repositories, ground truth,
  experiment runner, precision/recall/F1 metrics (no fabricated numbers).

## Architecture

A modular monolith: Next.js (App Router, TypeScript, Tailwind, shadcn/ui)
frontend, FastAPI backend, PostgreSQL (SQLite for local dev). Repository
execution is isolated in Docker. See `docs/architecture.md` (incl. Mermaid
diagram).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy 2 (async) |
| Database | PostgreSQL (asyncpg); SQLite for dev/tests |
| Parsing | Tree-sitter (Python/JS/TS, extensible) |
| Static tools | built-in RVX rules + ruff / bandit adapters |
| Execution | Docker sandbox (CPU/memory/time limits, no secrets) |
| LLM | provider abstraction: OpenAI / Anthropic / Gemini / Mock |

## Repository layout

```
backend/         FastAPI app: analysis engine, API, benchmark runner, prompts
frontend/        Next.js developer UI
bench/           benchmark configs, ground truth, reports
docs/            architecture, pipeline, evidence, verification, security, api, database, experiments, development
```

## Quick start

Prerequisites: Python 3.12+, Node 20+, Docker (for verification).

```bash
# 1. environment
cp .env.example .env        # set REPOVERIX_JWT_SECRET, optionally DB/LLM keys

# 2. backend
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e .
REPOVERIX_DATABASE_URL=sqlite+aiosqlite:///./data/dev.db \
  .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# 3. frontend
cd ../frontend
npm install
npm run dev                 # http://localhost:3000
```

API docs: http://localhost:8000/docs · health: `/health`.

Full docker-compose (PostgreSQL + backend + frontend) is available in
`docker-compose.yml` (local dev) and `docker-compose.prod.yml` (production
stack). CI runs on every push; a successful push to `main` also publishes
Docker images to GHCR and, once the deploy secrets are configured, ships the
stack to your server. See **[DEPLOY.md](DEPLOY.md)** for the full deployment
guide.

## Running an audit

1. Sign up / log in.
2. Upload the demo repository ZIP
   (`backend/tests/fixtures/repos/vulnerable_app` — deliberately vulnerable,
   fake credentials only) or connect a GitHub repo.
3. Start a scan (choose the experimental configuration).
4. Open a finding: read the evidence chain, severity, confidence, location.
5. **Generate Fix** → review the unified diff.
6. **Verify Fix** → watch the isolated run (tests, static checks, re-analysis)
   and the verdict.
7. Download the report: `GET /api/v1/scans/{id}/report?format=markdown`.

## Tests & quality

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -q      # 79 tests
.venv/Scripts/python -m ruff check app tests
cd ../frontend
npm run type-check
```

## Benchmark & experiments

```bash
cd backend
.venv/Scripts/python -m app.benchmark list
.venv/Scripts/python -m app.benchmark run --config ../bench/configs/experiments.json --out ../bench/reports
```

Results are computed only from real runs (`bench/reports/`); empty cells render
as `TBD`. Current expected comparison — **all values pending real runs**:

| Configuration | Precision | Recall | F1 | False Pos. Rate | Patch Correctness | Verification Success |
|---|---:|---:|---:|---:|---:|---:|
| Static Only | TBD | TBD | TBD | TBD | N/A | N/A |
| LLM Only | TBD | TBD | TBD | TBD | TBD | TBD |
| Static + LLM | TBD | TBD | TBD | TBD | TBD | TBD |
| RepoVeriX | TBD | TBD | TBD | TBD | TBD | TBD |

## Security model

Repository content is untrusted. ZIPs are traversal-checked and size-capped;
repository code never executes on the host — all execution is Docker-isolated
with resource limits, controlled networking and no host secrets. Repository
source is treated as **data** (never instructions) in LLM prompts, and likely
secrets are redacted before any LLM call. Details in `docs/security.md`.

## Research questions

- RQ1 How does repository-level context affect LLM defect detection?
- RQ2 Does static + LLM beat LLM-only precision/recall?
- RQ3 Does evidence validation reduce false positives?
- RQ4 Does execution-based verification improve repair correctness?

Hypotheses H1–H4 map onto the four configurations and the benchmark framework
(`docs/experiments.md`).

## Limitations (MVP)

- Languages: Python, JavaScript, TypeScript.
- In-process background task scheduling (single worker); a job queue is future
  work.
- Verification needs Docker; deterministic static analysis and template
  repairs do not.
- No PR auditing, CI integration, IDE extension, or continuous monitoring yet
  (see Future work below).

## Future work

GitHub App / pull-request auditing, CI/CD integration, an IDE extension or MCP
server, more languages, deeper data-flow analysis, semantic retrieval,
vulnerability-database correlation, team collaboration, and running the full
experiment matrix on a broader benchmark.

## Documentation index

`docs/architecture.md` · `docs/analysis-pipeline.md` · `docs/evidence-model.md`
· `docs/verification.md` · `docs/security.md` · `docs/database.md` ·
`docs/api.md` · `docs/experiments.md` · `docs/development.md` ·
`docs/implementation-plan.md`

## License

See `LICENSE`.

> **Disclaimer:** the demo/benchmark repositories are intentionally vulnerable
> and must never be deployed. All credentials in them are fake.
