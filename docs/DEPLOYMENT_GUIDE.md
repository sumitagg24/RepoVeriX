# RepoVeriX Production Deployment Guide

This guide walks through deploying the RepoVeriX platform for real startup users using **Neon PostgreSQL** and your choice of backend hosting (**Railway/Render** or a **VPS**).

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            Users / Clients             │
                      └───────────────────┬────────────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   ▼                                             ▼
       ┌───────────────────────┐                     ┌───────────────────────┐
       │   Frontend (Vercel)   │                     │  Backend API (FastAPI)│
       │ https://repoverix.com │ ──(API Requests)──> │ https://api.repoverix.com│
       └───────────────────────┘                     └───────────┬───────────┘
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    ▼                         ▼
                                       ┌───────────────────────┐ ┌───────────────────────┐
                                       │ Neon PostgreSQL (DB)  │ │ Cloudflare R2 / S3    │
                                       │ (AsyncPG Pooled SSL)  │ │ (Artifacts Storage)   │
                                       └───────────────────────┘ └───────────────────────┘
```

---

## 2. Database: Neon PostgreSQL Setup

1. Go to [https://neon.tech](https://neon.tech) and create a free account.
2. Create a project named `repoverix-production`.
3. In the Neon Console:
   - Click **Dashboard** -> **Connection Details**.
   - Enable **Connection Pooling** (checked).
   - Select `PostgreSQL 16`.
4. Copy the connection string (it will look like `postgresql://neondb_owner:***@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`).
5. Change the prefix to `postgresql+asyncpg://` so FastAPI can use its asynchronous connection pool:
   ```env
   REPOVERIX_DATABASE_URL=postgresql+asyncpg://neondb_owner:<PASSWORD>@<HOST>/neondb?ssl=require
   ```

---

## 3. Backend Hosting: Choose Your Platform

### Option A: Railway (Fastest, Zero Server Management)
1. Go to [https://railway.app](https://railway.app) and link your GitHub account.
2. Click **+ New Project** -> **Deploy from GitHub repo** -> Select `sumitagg24/repoverix`.
3. In Service Settings:
   - **Root Directory**: `backend`
   - **Builder**: `Dockerfile` (Railway will automatically use `backend/Dockerfile`)
4. In **Variables**, add:
   ```env
   REPOVERIX_DATABASE_URL=postgresql+asyncpg://neondb_owner:<PASSWORD>@<HOST>/neondb?ssl=require
   REPOVERIX_JWT_SECRET=<64-char-hex-generated-secret>
   REPOVERIX_CORS_ORIGINS=["https://repoverix.vercel.app","https://yourdomain.com"]
   REPOVERIX_ALLOWED_HOSTS=["*"]
   REPOVERIX_RATE_LIMIT_ENABLED=true
   REPOVERIX_AUTH_REQUIRE_EMAIL_VERIFICATION=false
   REPOVERIX_AUTO_CREATE_TABLES=true
   ```
5. Click **Generate Domain** in the Networking tab (e.g. `https://repoverix-production.up.railway.app`).

---

### Option B: VPS (Hetzner / DigitalOcean) for $4–$5/mo with Full Docker Sandbox
1. Create a server (Ubuntu 24.04, 2 vCPU, 4GB RAM) on Hetzner Cloud or DigitalOcean.
2. Point your DNS A record `api.yourdomain.com` -> `<VPS_IP>`.
3. Use the included script:
   ```bash
   REPOVERIX_VPS_HOST=<VPS_IP> REPOVERIX_VPS_KEY=~/.ssh/id_rsa bash scripts/provision-vps.sh
   ```
4. Caddy will automatically acquire SSL certificates for `api.yourdomain.com`.

---

## 4. Frontend: Vercel Connection

1. In your [Vercel Dashboard](https://vercel.com/dashboard), navigate to your RepoVeriX project.
2. Go to **Settings** -> **Environment Variables**.
3. Set:
   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   NEXT_PUBLIC_API_ORIGIN=https://api.yourdomain.com
   ```
4. Click **Deployments** -> **Redeploy** so the Next.js frontend builds with your live backend API URL.

---

## 5. Quick Verification
- Visit `https://api.yourdomain.com/health` -> Expect `{"status":"ok"}`.
- Visit `https://yourdomain.com/auth/sign-up` -> Register an account. The signup will now execute on the cloud database!
