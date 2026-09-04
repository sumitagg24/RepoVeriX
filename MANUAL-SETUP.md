# MANUAL-SETUP.md — What You Must Do Yourself

RepoVeriX's code is complete and tested, but it does **not** turn itself into a
public service. The sections below are the operator checklist: every secret,
account, and external service **you** must create or configure. All are
one-time, human steps. The app behaves sensibly while they are missing
(deterministic scans and template repairs still work), but the flagship
"AI audit + verified repair" experience needs them.

Quick truth table:

| Capability | Works with zero config? | What unlocks it |
|---|---|---|
| Signup / login / dashboard | ✅ yes (SQLite or Postgres) | — |
| ZIP upload + scan (static-only findings) | ✅ yes | — |
| Template-based fixes (SQLi, secrets, cmd-injection, eval, weak-hash) | ✅ yes | — |
| Docker verification (`VERIFIED REPAIR`) | ✅ yes, if Docker runs on the host | Docker daemon |
| GitHub URL ingestion | ✅ yes, **public** repos only | network egress; token for private |
| LLM reasoning / hybrid / LLM-only configs | ❌ no | an LLM API key (below) |
| LLM-generated fixes (non-template rules) | ❌ no | an LLM API key (below) |
| RepoVeriX-Bench `run` (configs A–D) | ⚠️ configs A–C only | an LLM API key for D |
| Real users on the internet | ❌ no | deployment (see DEPLOY.md) |

---

## 1. LLM provider API keys (the big one)

Without one of these, the `llm_reasoning` stage of every scan fails cleanly with
`llm_unconfigured` and you get only deterministic findings (the engine says so
in the scan log). To enable AI reasoning, generate-fix fallback, and the
`repoverix`/`hybrid`/`llm_only` configurations, set **at least one** key.

| Provider | Env var | Where to get the key | Default model |
|---|---|---|---|
| OpenAI | `REPOVERIX_OPENAI_API_KEY` | https://platform.openai.com/api-keys | `gpt-4o-mini` |
| Anthropic | `REPOVERIX_ANTHROPIC_API_KEY` | https://console.anthropic.com | `claude-3-5-haiku-latest` |
| Google Gemini | `REPOVERIX_GEMINI_API_KEY` | https://aistudio.google.com/apikey | `gemini-1.5-flash` |

Then pick the active provider:

```bash
REPOVERIX_LLM_PROVIDER=openai      # openai | anthropic | gemini | mock
REPOVERIX_LLM_MODEL=gpt-4o-mini    # override per provider
```

Notes:
- Keys are read from the backend environment (`.env` in `backend/` or the
  container env). They are **never** exposed to the frontend, stored in the DB,
  or leaked into prompts/reports (secret redaction is enforced at the API edge).
- `mock` provider exists for offline pipeline tests — it produces deterministic
  canned reasoning, **not** real analysis. Never use it for real audits.
- Cost controls you may want to tune: `REPOVERIX_LLM_MAX_CANDIDATES_PER_SCAN=60`,
  `REPOVERIX_LLM_MAX_CONTEXT_CHARS=24000`, `REPOVERIX_LLM_TIMEOUT_SECONDS=120`.

---

## 2. Database

### Local demo (zero setup)
The backend **defaults to PostgreSQL**, so for a laptop demo you must opt into
SQLite with one env var:

```bash
REPOVERIX_DATABASE_URL=sqlite+aiosqlite:///./data/dev.db
```

### Real deployment (PostgreSQL)
1. Install PostgreSQL (or run the `postgres` service in `docker-compose.prod.yml`).
2. Create the role and database:

```sql
CREATE USER repoverix WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE repoverix OWNER repoverix;
```

3. Point the backend at it:

```bash
REPOVERIX_DATABASE_URL=postgresql+asyncpg://repoverix:choose-a-strong-password@localhost:5432/repoverix
```

4. Tables are auto-created on startup while `REPOVERIX_AUTO_CREATE_TABLES=true`
   (the default). If you later adopt Alembic migrations (`backend/alembic/`),
   set it to `false` and run `alembic upgrade head` instead.

Back up the database before real use (`pg_dump`), and rotate the password
before pointing anything public at it.

---

## 3. OAuth apps (Google sign-in + GitHub/GitLab import)

Three OAuth clients are supported. All are optional — email/password auth and
URL/ZIP imports always work without them.

| Provider | Purpose | Where to register | Redirect URI to add |
|---|---|---|---|
| **Google** | One-click sign in/up | console.cloud.google.com/apis/credentials (Web client) | `http://localhost:8000/api/v1/auth/oauth/google/callback` |
| **GitHub** | Sign-in + browse & clone **private** repos | github.com/settings/developers | `…/api/v1/auth/oauth/github/callback` |
| **GitLab** | Sign-in + browse & clone **private** projects | gitlab.com/-/user_settings/applications | `…/api/v1/auth/oauth/gitlab/callback` |

Then set the env vars (see `.env.example`):

```bash
REPOVERIX_FRONTEND_URL=http://localhost:3000          # where OAuth lands
REPOVERIX_GOOGLE_OAUTH_CLIENT_ID=…
REPOVERIX_GOOGLE_OAUTH_CLIENT_SECRET=…
REPOVERIX_GITHUB_OAUTH_CLIENT_ID=…
REPOVERIX_GITHUB_OAUTH_CLIENT_SECRET=…
REPOVERIX_GITLAB_OAUTH_CLIENT_ID=…
REPOVERIX_GITLAB_OAUTH_CLIENT_SECRET=…
```

Scope requests: Google asks for `openid email profile`; GitHub for
`read:user user:email repo` (needed to list/clone private repos); GitLab for
`read_user read_api read_repository`. Tokens are stored in the `oauth_accounts`
table — treat the database as a secret store.

## 4. Auth secret (required before any public exposure)

The JWT signing secret has a development default and **must** be replaced
before users other than you can log in:

```bash
# generate once, keep secret
python -c "import secrets; print(secrets.token_hex(32))"
REPOVERIX_JWT_SECRET=<that value>
```

Also tune session length: `REPOVERIX_ACCESS_TOKEN_EXPIRE_MINUTES=1440` (1 day).

---

## 5. Docker (needed for verification + sandboxed test runs)

"Verify Fix" copies the repo, applies the patch, and runs tests **inside a
container**. That requires:

1. Docker installed and the daemon running on the same host as the backend
   (Docker Desktop on Windows/macOS, `dockerd` on Linux).
2. The backend process can reach the Docker socket (in a container deployment,
   mount the socket and install the `docker` CLI into the backend image — the
   `backend/Dockerfile` already ships the CLI).
3. Outbound image pulls: the first run pulls `python:3.12-slim` (and
   `node:20-slim` for JS repos). If the host is offline or firewalled, pulls
   fail and verification reports `repair_not_verified` with the reason in the
   execution log.
4. Optional hardening knobs: `REPOVERIX_SANDBOX_CPU_LIMIT=1.0`,
   `REPOVERIX_SANDBOX_MEMORY_LIMIT=1g`, `REPOVERIX_SANDBOX_TIMEOUT_SECONDS=600`,
   `REPOVERIX_SANDBOX_NETWORK=bridge` (bridge = container may download
   dependencies; `none` = fully offline, installs will fail).

---

## 6. Repository import sources

The UI's **Import repository** dialog supports five sources. What each needs:

- **GitHub** — connect your account (OAuth, §3) to browse + import public and
  **private** repos, or just paste a public URL.
- **GitLab** — same: connect (OAuth) to browse + import, or paste a public URL
  (gitlab.com or self-hosted instances).
- **AWS S3 / archive link** — paste a public S3 object URL or a **presigned
  S3 URL** (or any hosted `.zip`: release asset, codeload…). The backend
  downloads it once with size caps and extracts it with the same hardening as
  ZIP uploads. Registration happens immediately; the download runs at scan
  time.
- **ZIP upload** — upload from your computer (≤ 100 MB).
- **Other git** — paste any https git URL: Bitbucket, Azure DevOps, Codeberg,
  self-hosted.

Host requirements: `git` + egress to the git host for clone sources; egress to
bucket/archive hosts for S3-style links. The clone fallback handles repos whose
default branch isn't `main`.

---

## 7. Frontend → backend URL

The Next.js app talks to the API through one build-time variable:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000   # dev; NO /api/v1 suffix — the app appends it
```

In production set it to the public backend origin (e.g.
`https://api.repoverix.example.com`). Because it is baked in at build time,
rebuild the frontend image when you change it. CORS on the backend must list
the frontend origin: `REPOVERIX_CORS_ORIGINS=["https://repoverix.example.com"]`
(defaults allow `localhost:3000` and `127.0.0.1:3000`).

---

## 8. RepoVeriX-Bench (research experiments)

The bench harness is ready (`cd backend && python -m app.benchmark run`). To
produce real numbers instead of `TBD`:

1. Set one LLM key (section 1).
2. Run the four-configuration matrix against the fixture repos in
   `backend/tests/fixtures/repos/` (ground truth is already encoded).
3. Results land in `bench/reports/*.json` with a summary table; feed them into
   the metrics tables in `docs/experiments.md`.

Never fabricate these numbers — the whole point of the project is that they
come from actual runs.

---

## 9. Putting it online for real users

GitHub cannot host the running app. Use the deploy kit (already committed):

1. Follow `DEPLOY.md`: push to GitHub → CI runs tests → the Deploy workflow
   publishes `ghcr.io/sumitagg24/repoverix-backend` and
   `.../repoverix-frontend` images automatically.
2. On a server with Docker: `docker compose -f docker-compose.prod.yml up -d`
   (Postgres + backend + frontend) with the env values from this file.
3. Put a reverse proxy (Caddy/nginx) in front, set the env values above, and
   point `NEXT_PUBLIC_API_URL` at the API origin before building.

Manual one-time steps on the server: create the Postgres user/database,
generate `REPOVERIX_JWT_SECRET`, set LLM keys, ensure Docker + git are
installed, open ports 80/443.

---

## 10. Before-you-ship checklist

- [ ] `REPOVERIX_JWT_SECRET` replaced with a long random value
- [ ] `REPOVERIX_DATABASE_URL` points at a Postgres instance with a strong password
- [ ] At least one LLM key set (OpenAI recommended) and provider chosen
- [ ] OAuth clients registered and redirect URIs added (Google for sign-in; GitHub/GitLab for private imports)
- [ ] `REPOVERIX_FRONTEND_URL` matches the public frontend origin
- [ ] Docker daemon reachable from the backend; `python:3.12-slim` pull works
- [ ] `NEXT_PUBLIC_API_URL` = public backend origin; frontend rebuilt
- [ ] `REPOVERIX_CORS_ORIGINS` includes the real frontend origin
- [ ] Backend `git` installed and egress to github.com allowed (for git imports)
- [ ] Smoke test with a real account: signup (incl. Google) → import repo (GitHub URL, S3 link, ZIP) → scan → generate fix → verify
