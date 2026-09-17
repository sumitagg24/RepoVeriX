# Deploying RepoVeriX

RepoVeriX is a three-part stack:

| Component | Tech | Notes |
| --- | --- | --- |
| `frontend/` | Next.js 14 | Served on port 3000; talks to the API from the browser |
| `backend/` | FastAPI (Python 3.12) | All scanning + repair + verification logic, port 8000 |
| `postgres` | PostgreSQL 16 | Main database |

Everything is packaged with Docker. The repository already runs in CI (`git push`
→ `.github/workflows/ci.yml`) and every push to `main` builds the images and
publishes them to **GitHub Container Registry**
(`ghcr.io/<owner>/repoverix-backend` / `repoverix-frontend`).

---

## 1. Try the whole stack locally (fastest)

Requirements: Docker with Compose v2.

```bash
cp .env.example .env          # optional; compose defaults work for local
docker compose -f docker-compose.prod.yml up -d --build
```

Then open:

- UI → http://localhost:3000
- API docs → http://localhost:8000/docs
- Health → http://localhost:8000/health

`docker compose -f docker-compose.prod.yml down` stops it (add `-v` to wipe the
database volumes).

> **Patch verification needs the Docker socket.** Verification of a candidate
> patch runs the patched repository inside a *fresh* Docker container. If the
> backend cannot reach a Docker daemon, verification reports an honest runner
> error instead of a verdict. For a real host, uncomment the
> `/var/run/docker.sock:/var/run/docker.sock` mount in
> `docker-compose.prod.yml`. Only do this on a host dedicated to RepoVeriX —
> the socket grants control of the daemon.

## 2. Production configuration

Create a `.env` next to `docker-compose.prod.yml` with at least:

```bash
# REQUIRED — generate with:
#   python -c "import secrets; print(secrets.token_hex(32))"
REPOVERIX_JWT_SECRET=<64-hex-characters>

# Optional: LLM providers (no LLM analysis otherwise)
REPOVERIX_LLM_PROVIDER=openai            # openai | anthropic | gemini | mock
REPOVERIX_OPENAI_API_KEY=sk-...
# REPOVERIX_ANTHROPIC_API_KEY=...
# REPOVERIX_GEMINI_API_KEY=...

# Postgres credentials (defaults: repoverix/repoverix/repoverix)
POSTGRES_USER=repoverix
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=repoverix
```

Environment variable reference: see `.env.example` at the repository root. Every
backend setting is prefixed with `REPOVERIX_` and is read from the environment.

### 2a. Serving the frontend from a real domain

`NEXT_PUBLIC_API_URL` is baked into the browser bundle at **build time**. If the
API is served from a different origin than the UI:

1. Rebuild the frontend with the public API URL:

   ```bash
   docker compose -f docker-compose.prod.yml build \
     --build-arg NEXT_PUBLIC_API_URL=https://api.your-domain.com frontend
   ```

   (Or set `NEXT_PUBLIC_API_URL` as a repository *variable* in GitHub → Settings
   → Secrets and variables → Actions, and let the deploy workflow rebuild it.)

2. Add the UI origin to the backend CORS allow-list in
   `docker-compose.prod.yml`:

   ```yaml
   REPOVERIX_CORS_ORIGINS: '["https://your-domain.com"]'
   ```

## 3. Deploying to a server (via GitHub Actions)

`.github/workflows/deploy.yml` pushes GHCR images on every `main` push and, when
the deploy secrets exist, also ships the code to your server and runs the stack.

1. On the server (a small VPS with Docker installed, e.g. 2 vCPU / 4 GB):

   ```bash
   sudo mkdir -p /opt/repoverix && sudo chown $USER /opt/repoverix
   ```

2. Generate an SSH keypair, add the **public** key to the server's
   `~/.ssh/authorized_keys` for the deploy user, and add these **secrets** to
   the GitHub repository (Settings → Secrets and variables → Actions):

   | Secret | Value |
   | --- | --- |
   | `DEPLOY_HOST` | `203.0.113.10` |
   | `DEPLOY_USER` | `deploy` (or `root`) |
   | `DEPLOY_SSH_KEY` | private key (PEM) |
   | `DEPLOY_PATH` | `/opt/repoverix` |
   | `DEPLOY_ENV` | contents of the production `.env` from section 2 |

3. Push to `main` (or run the **Deploy** workflow manually). The workflow syncs
   the code, writes `.env`, and runs:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --remove-orphans
   ```

4. Open `http://<server-ip>:3000`.

### Reverse proxy (optional but recommended)

Terminate TLS in front of ports 3000/8000 with Caddy or nginx, e.g. with Caddy:

```
your-domain.com {
    reverse_proxy 127.0.0.1:3000
}
api.your-domain.com {
    reverse_proxy 127.0.0.1:8000
}
```

Then set `NEXT_PUBLIC_API_URL=https://api.your-domain.com` and
`REPOVERIX_CORS_ORIGINS='["https://your-domain.com"]'` and rebuild.

## 4. Deployment checklist

- [ ] `REPOVERIX_JWT_SECRET` is a long random value, never the default
- [ ] `POSTGRES_PASSWORD` is strong
- [ ] No real API keys were committed (the repo keeps `.env*` out of Git)
- [ ] CORS allow-list contains exactly the browser origin(s) you serve
- [ ] Docker socket mount is only enabled on a dedicated host
- [ ] Migrations: run `alembic upgrade head` against PostgreSQL on deploy
      (keep `REPOVERIX_AUTO_CREATE_TABLES=false` in production; SQLite dev
      environments use `create_all` instead)
- [ ] Startup fails fast if `REPOVERIX_JWT_SECRET` is left at its default on a
      public Host allowlist — this is intentional, configure the secret
- [ ] HTTPS terminates at a reverse proxy; never expose port 8000 directly
