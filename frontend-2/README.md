# RepoVeriX — frontend-2

A new, independent frontend for RepoVeriX: **find code risks, understand impact, verify the fix.**

`frontend-2` is a complete Next.js (App Router) application built from scratch. It talks to the
existing FastAPI backend without a single backend change, and it does not import anything from the
existing `frontend` application.

- Runs on **http://localhost:3001** so it can run beside the existing frontend on 3000.
- Light-first design system with an optional dark theme.
- Same-origin API proxy, so no CORS configuration is required.
- Real data only: every screen is backed by a live endpoint, and the interface says so when data is
  missing instead of inventing it.

## Quick start

```bash
cd frontend-2
cp .env.example .env.local     # optional — defaults work for local development
npm install
npm run dev                    # http://localhost:3001
```

The backend must be running for authenticated screens:

```bash
# from the repository root
cd backend
REPOVERIX_DATABASE_URL=sqlite+aiosqlite:///./data/dev.db \
  .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Open http://localhost:3001, create an account, and the app will walk through onboarding.

## How the backend is used

The existing API is treated as fixed. Two decisions make that possible:

**1. Same-origin API proxy.** The browser only ever calls `/api/v1/*` on this app's own origin, and
Next proxies it server-side to the API (see `next.config.mjs`):

```
browser → localhost:3001/api/v1/... → localhost:8000/api/v1/...
```

Because no request is cross-origin, the backend needs **no CORS change** to run on port 3001. Set
`API_ORIGIN` to point at another backend deployment, or set `NEXT_PUBLIC_API_URL` to bypass the proxy
and call the API directly (that mode does require the backend's `REPOVERIX_CORS_ORIGINS` to include
this origin).

**2. Unchanged contracts.** `src/types/api.ts` mirrors the FastAPI schemas field for field, and
`src/services/api.ts` maps one-to-one onto the existing endpoints — same paths, same methods, same
payloads, same bearer-token authentication. Naive UTC timestamps are normalized the same way the old
client did, so relative times are correct.

### Two backend environment settings affect this app (no code change required)

These are deployment configuration, not code, and both default to port 3000:

| Variable | Why it matters |
|---|---|
| `REPOVERIX_FRONTEND_URL` | The backend redirects here after OAuth and after billing checkout/portal actions. Set it to `http://localhost:3001` to review those flows in this app. |
| `REPOVERIX_CORS_ORIGINS` | Only needed if you bypass the proxy with `NEXT_PUBLIC_API_URL`. |

## Routes

**Public** (indexed): `/` · `/product` · `/solutions` · `/integrations` · `/pricing` · `/resources` ·
`/docs` · `/docs/getting-started` · `/docs/concepts` · `/docs/api` · `/docs/faq` · `/privacy` ·
`/terms` · `/robots.txt` · `/sitemap.xml`

**Auth**: `/auth/sign-in` · `/auth/sign-up` · `/auth/forgot-password` · `/auth/reset-password` ·
`/auth/verify-email` · `/auth/oauth/callback`

**Application** (never indexed): `/dashboard` · `/repositories` · `/repositories/new` ·
`/repositories/[id]` · `/scans` · `/scans/new` · `/scans/[id]` · `/findings` · `/findings/[id]` ·
`/rules` · `/rules/[slug]` · `/billing` · `/settings` · `/settings/security` ·
`/settings/integrations` · `/settings/team` · `/onboarding` · `/help`

## Project structure

```
src/
  app/
    (marketing)/      public site (header, footer, docs)
    (auth)/           sign-in, sign-up, recovery, verification
    (app)/            authenticated workspace behind the app shell
    layout.tsx        metadata, JSON-LD, providers, skip link
    robots.ts sitemap.ts
  components/
    ui/               design system primitives (button, badge, table, dialogs, charts, code)
    layout/           site header, footer, page header, breadcrumbs, theme toggle
    marketing/        hero, product frames, workflow tabs, pricing, FAQ, integrations
    app/              app shell, sidebar nav, command palette, workspace switcher, onboarding
    findings/         findings table, evidence chain, remediation panel
    scans/            scan history table
  context/            auth and theme providers
  hooks/              TanStack Query hooks per domain
  lib/                domain vocabulary, formatting, dates, site config, rules, FAQs
  services/api.ts     the only place that knows about HTTP
  types/api.ts        backend contract types
```

## Design system

- **Light-first.** Warm off-white canvas (`#f7f5f1`), white product surfaces, charcoal text, one
  cobalt accent. The workspace stays neutral; colour is spent on the public surface.
- **Dark mode** is a deliberate re-tint (warm slate, raised contrast) — not the old terminal
  aesthetic, and never an inverted copy of the light theme.
- **Semantic security colours** (critical/high/medium/low/verified) always ship with a text label;
  colour is never the only signal.
- **Tokens only.** Every colour is a CSS variable declared in `src/app/globals.css`, re-exported to
  Tailwind through `@theme` (Tailwind v4 — there is no `tailwind.config.ts`). No component
  hard-codes a palette value.
- **Radii ≤ 8px** on cards, panels and plates. Badges and status dots are the only round shapes.
- **Monospace** is reserved for code, paths, rule IDs, commit hashes and machine counts.
- **Marketing art direction.** Colour arrives as a surface the product rests on, not as a page-wide
  gradient: `.wash-plate` / `.wash-panel` for panels, `.float-plate` and `.frag` for the white
  product surfaces layered on top. `.wash-panel` keeps white text on every gradient stop;
  `.wash-plate` mixes the accent into the card colour so dark ink survives a theme change.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build on port 3001 |
| `npm run lint` | ESLint (`next lint`) |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | Jest unit tests |

## Accessibility and performance notes

- Radix primitives for dialogs, drawers, menus, tabs, tooltips and accordions, so focus trapping,
  Escape handling and ARIA wiring come from one place.
- Skip link, semantic landmarks, visible focus rings, labelled icon-only controls, `aria-pressed`
  filter chips and announced validation errors.
- `prefers-reduced-motion` disables all motion globally.
- Wide tables scroll inside their own container rather than breaking the page on mobile.
- Charts are hand-rolled SVG driven by real counts, each with a text equivalent.

## Known limitations (no frontend workaround)

- **OAuth and billing redirects** land on whatever `REPOVERIX_FRONTEND_URL` points at. Reviewing those
  flows on port 3001 requires that variable to be updated by the operator.
- **Model reasoning and sandbox verification** require a plan that includes them; the API returns 402
  and the interface renders an upgrade state rather than a partial screen.
- **Rule configuration** is not editable: the backend exposes no rule settings endpoint, so the rules
  screen is a reference catalogue.
- **Server-side pagination totals** are not exposed by the list endpoints, so long lists page in the
  browser over the most recent matches (200 records per request, the API maximum).

## Replacing the old frontend later

1. Point the deployment at `frontend-2` (its `Dockerfile`/build context, and the compose service).
2. Move the frontend port mapping from the old service to the new one.
3. Set `REPOVERIX_FRONTEND_URL` (and CORS origins, if bypassing the proxy) to the production URL.
4. Verify the public routes render and authenticated redirects land correctly.
5. Only then remove the old `frontend` directory — nothing in `frontend-2` depends on it.
