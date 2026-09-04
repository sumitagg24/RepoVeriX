# Development

## Local setup

```bash
# Backend (Python 3.12)
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"      # (Windows) adjust for your shell
.venv/Scripts/python -m pip install -e .

# Frontend (Node 20+)
cd frontend
npm install
```

Copy `.env.example` to `.env` and set at least `REPOVERIX_JWT_SECRET`. The
default `REPOVERIX_DATABASE_URL` targets PostgreSQL; for a quick start use
SQLite:

```
REPOVERIX_DATABASE_URL=sqlite+aiosqlite:///./data/dev.db
```

## Running

```bash
# Backend API (http://localhost:8000, docs at /docs)
cd backend
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# Frontend (http://localhost:3000)
cd frontend
npm run dev
```

Scans run in-process in the background (modular monolith). Verification
requires a running Docker daemon (`DockerRunner`); without Docker, verification
reports `repair_not_verified` with a clear message. Repository storage defaults
to `backend/data/repositories`.

## Tests

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -q          # 79 tests
.venv/Scripts/python -m ruff check app tests
.venv/Scripts/python -m ruff format app tests      # format at 110 cols

cd frontend
npm run type-check
```

The suite includes: auth, ZIP security, parsing, detectors, orchestrator
end-to-end scans of seeded vulnerable repos (static/LLM/hybrid modes),
repair-template generation, Docker-runner verification (via a local runner
seam), benchmark metrics and report endpoints. `tests/fixtures/repos/` hold the
intentionally vulnerable repositories used by tests, demos and the benchmark.

## End-to-end demo

The flagship flow is covered by `tests/test_verify.py` and can be reproduced
live:

1. start backend + frontend,
2. sign up,
3. upload a ZIP of `backend/tests/fixtures/repos/vulnerable_app`,
4. start a `repoverix` scan,
5. open the SQL Injection finding (VERIFIED, hybrid),
6. **Generate Fix** → review the unified diff,
7. **Verify Fix** → Docker applies the patch, runs pytest, checks ruff and
   re-analyzes the finding → `VERIFIED REPAIR`,
8. download the scan report (`/scans/{id}/report?format=markdown`).

## LLM configuration

`REPOVERIX_LLM_PROVIDER=openai|anthropic|gemini` plus the matching key. Without
any key the system degrades gracefully: deterministic findings still complete
and LLM-dependent stages are recorded as failed with guidance. `MockProvider`
is used by tests; `provider=mock` can also be selected in settings.

## Committing

Follow conventional-commit style (`feat:`, `fix:`, `test:`, `docs:`). Keep
checkpoints working: run backend tests + ruff and the frontend type-check
before committing. All commits in this repo are generated with Codebuff.
