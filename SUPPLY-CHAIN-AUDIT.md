# RepoVeriX — Software Supply Chain, Dependency & Build Integrity Audit

**Audit Target**: RepoVeriX Platform (Post-v0.2.2 Hardening)  
**Date**: September 2026  
**Canonical Frontend**: `frontend-2/` (Next.js 14 App Router)  
**Backend**: FastAPI + SQLAlchemy (Async) + PostgreSQL  
**Audit Scope**: Dependency Inventory, Lockfile Integrity, Vulnerability Scanning (`pip-audit`, `npm audit`), Typosquatting / Malicious Package Detection, GitHub Actions Supply Chain, Build Reproducibility, Container Security, Secret Exposure in Builds, Source Map Protections, and Supply Chain Regression Testing.

---

## 1. Executive Summary

A software supply-chain and build-integrity audit was performed on RepoVeriX. All third-party dependencies, package lockfiles, container images, build scripts, and GitHub Actions workflows were inventoried and audited for tamper-resistance, vulnerability status, secret exposure, and deterministic reproducibility.

### Key Audit Outcomes
1. **Lockfile Integrity Restored**: Generated and committed `frontend-2/package-lock.json` (v3 lockfile), enabling deterministic `npm ci` builds across CI/CD and Docker containers.
2. **Zero Known Backend Vulnerabilities**: `pip-audit` scanned all direct and transitive Python dependencies; 0 known vulnerabilities found.
3. **Frontend Vulnerability Assessment**: Evaluated 5 advisories from `npm audit` across `glob`, `next`, and `postcss`. Determined zero exploitability in RepoVeriX's deployment configuration (static inline SVG assets, absence of Server Actions/WebSocket proxying, and devDependency scoping).
4. **GitHub Actions Immutability**: Pinned all GitHub Actions in `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` to immutable 40-character commit SHAs with version annotations.
5. **Zero Secret Leakage in Builds**: Confirmed all `NEXT_PUBLIC_*` environment variables are strictly non-sensitive configuration keys (`API_URL`, `API_ORIGIN`, `SITE_URL`).
6. **Source Map Hardening**: Verified zero `.map` files emitted in production client bundles; explicitly set `productionBrowserSourceMaps: false` in `next.config.mjs`.
7. **Rootless Containers**: Verified both backend and frontend production Docker images execute under unprivileged system users (`USER repoverix`, `USER nextjs`).
8. **Automated Regression Suite**: Created `backend/tests/test_supply_chain.py` testing lockfile presence, client env boundaries, source map flags, and workflow permissions.

---

## 2. Comprehensive Dependency Inventory

### 2.1 Backend (`backend/pyproject.toml`)

| Dependency | Type | Declared Version | Resolved Version | License | Purpose |
|---|---|---|---|---|---|
| `fastapi` | Direct / Runtime | `>=0.115` | `0.141.1` | MIT | Core HTTP API framework |
| `uvicorn[standard]` | Direct / Runtime | `>=0.30` | `0.52.4` | BSD-3-Clause | ASGI application server |
| `sqlalchemy[asyncio]` | Direct / Runtime | `>=2.0.30` | `2.0.52` | MIT | Async ORM and database engine |
| `asyncpg` | Direct / Runtime | `>=0.29` | `0.31.0` | Apache-2.0 | PostgreSQL async database driver |
| `aiosqlite` | Direct / Runtime | `>=0.20` | `0.22.1` | MIT | SQLite async driver (local/test) |
| `alembic` | Direct / Runtime | `>=1.13` | `1.19.1` | MIT | Database schema migrations |
| `pydantic[email]` | Direct / Runtime | `>=2.7` | `2.13.5` | MIT | Data parsing, validation, email checks |
| `pydantic-settings` | Direct / Runtime | `>=2.3` | `2.15.0` | MIT | Environment variable configuration |
| `pyjwt` | Direct / Runtime | `>=2.8` | `2.13.0` | MIT | Stateless session token signing (HS256) |
| `bcrypt` | Direct / Runtime | `>=4.1` | `5.0.0` | Apache-2.0 | Password hashing |
| `cryptography` | Direct / Runtime | `>=42.0` | `50.0.1` | Apache-2.0 / BSD | Token encryption at rest (Fernet) |
| `python-multipart` | Direct / Runtime | `>=0.0.9` | `0.0.32` | Apache-2.0 | Multi-part form/archive upload parsing |
| `httpx` | Direct / Runtime | `>=0.27` | `0.28.1` | BSD-3-Clause | Async HTTP client (OAuth, SSRF checks) |
| `tree-sitter` | Direct / Runtime | `>=0.23` | `0.26.0` | MIT | Incremental parsing engine |
| `tree-sitter-python` | Direct / Runtime | `>=0.23` | `0.25.0` | MIT | Python AST grammar parser |
| `tree-sitter-javascript` | Direct / Runtime | `>=0.23` | `0.25.0` | MIT | JavaScript AST grammar parser |
| `tree-sitter-typescript` | Direct / Runtime | `>=0.23` | `0.23.2` | MIT | TypeScript AST grammar parser |
| `pytest` | Direct / Dev | `>=8` | `9.1.1` | MIT | Backend test runner |
| `pytest-asyncio` | Direct / Dev | `>=0.23` | `1.4.0` | Apache-2.0 | Async test execution fixtures |
| `ruff` | Direct / Dev | `>=0.5` | `0.16.6` | MIT | Code formatting and linting |
| `pip-audit` | Direct / Dev | `>=2.7` | `2.10.1` | Apache-2.0 | Supply chain vulnerability scanner |

### 2.2 Frontend (`frontend-2/package.json`)

| Dependency | Type | Declared Version | Purpose |
|---|---|---|---|
| `next` | Direct / Runtime | `14.2.35` | React framework, SSR, App Router, static generation |
| `react` / `react-dom` | Direct / Runtime | `^18.3.1` | UI runtime and component tree |
| `@tanstack/react-query`| Direct / Runtime | `^5.103.1` | Server state management, caching, optimistic updates |
| `axios` | Direct / Runtime | `^1.20.0` | Client-side HTTP requests |
| `react-hook-form` | Direct / Runtime | `^7.88.0` | Form state management |
| `@hookform/resolvers` | Direct / Runtime | `^3.10.0` | Zod schema validation bridge |
| `zod` | Direct / Runtime | `^3.25.76` | Type-safe schema validation |
| `lucide-react` | Direct / Runtime | `^0.408.0` | UI icon set |
| `simple-icons` | Direct / Runtime | `^13.21.0` | Brand and provider iconography |
| `sonner` | Direct / Runtime | `^1.7.4` | Toast notifications |
| `motion` | Direct / Runtime | `^12.43.0` | Fluid animations and transitions |
| `geist` | Direct / Runtime | `^1.7.2` | Typography and font optimization |
| `date-fns` | Direct / Runtime | `^3.6.0` | Date manipulation and relative formatting |
| `tailwind-merge` | Direct / Runtime | `^3.7.0` | Tailwind class conflict resolution |
| `clsx` | Direct / Runtime | `^2.1.1` | Conditional class name construction |
| `class-variance-authority` | Direct / Runtime | `^0.7.1` | Type-safe component variant styles |
| `@radix-ui/*` | Direct / Runtime | Multiple | Accessible, unstyled UI primitives |
| `typescript` | Dev | `^5.9.3` | Static type checking (`tsc`) |
| `eslint` / `eslint-config-next` | Dev | `^8.57.1` / `14.2.35` | Code quality and React/Next linting |
| `jest` / `@testing-library/*` | Dev | `^29.7.0` | Unit and component testing |
| `tailwindcss` / `@tailwindcss/postcss` / `postcss` | Dev | `^4.3.3` / `^8.5.28` | Utility-first CSS compiler |

### 2.3 Container Packages & Base Images

- **Backend Base Image**: `python:3.12-slim` (Debian Bookworm minimal)
  - Installed system packages: `git`, `ca-certificates`, `curl`
  - Standalone Docker CLI: `v27.1.1` binary (downloaded via official static release tarball)
- **Frontend Base Image**: `node:20-alpine` (Alpine Linux minimal)
  - Runtime: Node.js `20.x`, npm `10.x`
- **Database Base Image**: `postgres:16-alpine`

### 2.4 GitHub Actions

- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (`v4.2.2`)
- `actions/setup-python@42375524e23c412d93fb67b49958b491fce71c38` (`v5.4.0`)
- `actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a` (`v4.2.0`)
- `docker/login-action@9780b0c442f8482e98f40a7188013c2f10f2b94f` (`v3.3.0`)
- `docker/build-push-action@471d1dc4e07e5cdedd4c2171150001c434f0b7a4` (`v6.15.0`)

---

## 3. Lockfile Integrity & Determinism

### 3.1 Lockfile Status
- **Backend**: Python dependencies are defined with exact lower bounds in `pyproject.toml` and installed via `pip install .` in Docker / CI. Python packages are audited on every run using `pip-audit`.
- **Frontend**: Generated `frontend-2/package-lock.json` containing 758 audited packages. `package-lock.json` pins exact SHA-512 integrity hashes and exact package URLs from the npm registry.

### 3.2 Deterministic Installation Verification
- Running `npm ci` in `frontend-2` guarantees exact bit-for-bit package tree reproduction without resolving floating semver ranges (`^`, `~`).
- Docker builds in `frontend-2/Dockerfile` execute `npm ci --legacy-peer-deps` using the committed lockfile.

---

## 4. Vulnerability Scanning & Risk Assessment

### 4.1 Backend Scan (`pip-audit`)
- **Command**: `pip-audit --skip-editable`
- **Result**: `No known vulnerabilities found` across all 52 installed Python packages.

### 4.2 Frontend Scan (`npm audit`)
- **Command**: `npm audit`
- **Findings Summary**: 5 advisories identified (4 High, 1 Critical). Detailed exploitability assessment below:

| Package | Version | Advisory | Severity | Exploitability in RepoVeriX | Breaking Change Risk of Fix | Action Taken / Recommendation |
|---|---|---|---|---|---|---|
| `glob` | `10.3.10` | GHSA-5j98-mcp5-4vw2 (CLI `-c` command injection) | High | **Zero**. `glob` is used strictly as an in-memory library by ESLint tooling during development/linting; the `glob` CLI is never invoked in production or build scripts. | High (Requires upgrading to ESLint 9 + `eslint-config-next@16`) | Retain currently pinned version; devDependency only. |
| `next` | `14.2.35` | GHSA-9g9p-9gw9-jx7f (DoS in Image Optimizer remotePatterns) | Critical | **Zero**. RepoVeriX does not proxy remote images; all 7 OAuth provider brand icons and application logos are packaged locally as static inline SVGs. | High (Upgrading to Next.js 15+ breaks React 18 peer dependencies and async App Router APIs) | Keep pinned on stable Next.js `14.2.35`; preserve local inline SVG pattern. |
| `next` | `14.2.35` | GHSA-m99w-x7hq-7vfj (Server Actions DoS) | High | **Zero**. RepoVeriX frontend uses standard Next.js route handlers (`src/app/api/v1/[...path]/route.ts`) and React Query client fetches, avoiding Server Actions. | High (Breaking framework upgrade) | Keep current App Router route handler pattern. |
| `next` | `14.2.35` | GHSA-c4j6-fc7j-m34r (WebSocket SSRF in custom server) | High | **Zero**. RepoVeriX Next.js app is hosted standalone or on Vercel without WebSocket custom server proxies. | High | Keep standalone container configuration. |
| `postcss` | `8.4.31` (nested in `next`) | GHSA-6g55-p6wh-862q (CSS `sourceMappingURL` parsing) | High | **Zero**. PostCSS executes exclusively at build time on local developer CSS. No user-uploaded CSS stylesheets are parsed dynamically at runtime. | High | Root PostCSS is `8.5.28`; internal bundler copy is isolated. |

---

## 5. Typosquatting & Suspicious Dependency Inspection

1. **Lifecycle Script Audit**:
   - Scanned all 758 packages in `frontend-2/package-lock.json` for `preinstall`, `install`, or `postinstall` shell hooks.
   - **Result**: `0` lifecycle scripts present. No package executes arbitrary binary downloads or node scripts during installation.
2. **Namespace Analysis**:
   - All critical UI primitives and animation packages originate from official, verified scopes (`@radix-ui/*`, `@tanstack/*`, `@hookform/*`, `@types/*`, `@tailwindcss/*`).
   - Iconography is served via official packages (`lucide-react`, `simple-icons`).

---

## 6. GitHub Actions Supply Chain & Workflow Hardening

### 6.1 Action Pinning
All workflow action references have been pinned to exact immutable 40-character commit SHAs:
- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (`v4.2.2`)
- `actions/setup-python@42375524e23c412d93fb67b49958b491fce71c38` (`v5.4.0`)
- `actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a` (`v4.2.0`)
- `docker/login-action@9780b0c442f8482e98f40a7188013c2f10f2b94f` (`v3.3.0`)
- `docker/build-push-action@471d1dc4e07e5cdedd4c2171150001c434f0b7a4` (`v6.15.0`)

### 6.2 Permissions & PR Isolation
- `ci.yml`: Top-level `permissions: contents: read`. Pull requests from forks execute without repository write permissions or secret access.
- `deploy.yml`: Restricted to `main` branch pushes and manual triggers (`workflow_dispatch`). Deploys are scoped to the `production` GitHub environment.

---

## 7. Container Supply Chain & Runtime Isolation

1. **Backend Container (`backend/Dockerfile`)**:
   - Minimal base: `python:3.12-slim`.
   - Package manager caches removed: `rm -rf /var/lib/apt/lists/*`.
   - Pip cache disabled: `PIP_NO_CACHE_DIR=1`, `PIP_DISABLE_PIP_VERSION_CHECK=1`.
   - Unprivileged user: `USER repoverix` (UID/GID isolated, ownership assigned only to `/data` and `/app`).
2. **Frontend Container (`frontend-2/Dockerfile`)**:
   - Multi-stage build: `node:20-alpine AS builder` and `node:20-alpine AS runner`.
   - Build environment variables isolated: only `NEXT_PUBLIC_*` passed as build args; no backend secrets mounted.
   - Unprivileged user: `USER nextjs` (system UID/GID 1001).
   - Minimal runtime footprint: source code discarded; only compiled `.next`, `node_modules`, `package.json`, and `public` copied to final stage.

---

## 8. Secret Exposure Prevention & Source Maps

### 8.1 Client Environment Audit
- Evaluated all occurrences of `NEXT_PUBLIC_*` across `frontend-2/src`:
  - `NEXT_PUBLIC_API_URL`: Backend API host
  - `NEXT_PUBLIC_API_ORIGIN`: Same-origin proxy target
  - `NEXT_PUBLIC_SITE_URL`: Canonical URL for SEO metadata
- **Result**: Zero API secrets, database connection strings, JWT keys, Stripe credentials, or tokens are exposed to client JavaScript.

### 8.2 Source Map Protection
- Verified `.next/static/` directory after production build: `0` `.map` files generated.
- Hardened `frontend-2/next.config.mjs` with explicit `productionBrowserSourceMaps: false`.

---

## 9. Automated Supply Chain Tests

Implemented automated tests in `backend/tests/test_supply_chain.py`:
- `test_frontend_lockfile_exists_and_matches`: Enforces lockfile version (v2/v3) and verifies resolution of all `package.json` dependencies.
- `test_no_sensitive_next_public_env_vars`: Scans frontend TypeScript files with regex guards preventing any `NEXT_PUBLIC_*SECRET*`, `*KEY*`, `*PASSWORD*`, or `*TOKEN*` variables.
- `test_next_config_disables_production_source_maps`: Validates that `productionBrowserSourceMaps: false` is explicitly configured.
- `test_github_actions_least_privilege_permissions`: Checks all `.github/workflows/*.yml` files for explicit `permissions:` declarations.

---

## 10. Audit Verification Results

```text
Backend Test Suite:
pytest tests/ -q
436 passed, 4 skipped in 80.50s

Supply Chain Tests:
pytest tests/test_supply_chain.py -v
4 passed in 0.09s

Frontend Typecheck:
tsc --noEmit
0 errors

Frontend Test Suite:
jest
3 test suites, 11 tests passed

Frontend Production Build:
next build
38/38 pages compiled and optimized cleanly (0 errors)
```
