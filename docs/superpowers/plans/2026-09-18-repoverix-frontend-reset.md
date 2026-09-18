# RepoVeriX Frontend Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restart the RepoVeriX frontend inside the existing Next.js app so marketing, auth, and product surfaces share one competitor-grade security command-center UI.

**Architecture:** Keep the backend contracts, hooks, route inventory, CSP, metadata, and SEO data modules. Rebuild the frontend around one RVX console system: global tokens, marketing shell, auth shell, product shell, signal spine, dense ledgers, typed status badges, and route-specific compositions that answer one user question per screen.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Radix UI primitives, lucide-react, TanStack Query, Playwright.

**Spec:** `docs/frontend-redesign-blueprint.md`

## Global Constraints

- Preserve every shipped route unless a route is already invalid and replaced by an equivalent real route.
- Preserve CSP nonce flow from `src/middleware.ts` and `src/lib/csp-server.ts`.
- Preserve canonical metadata, sitemap generation, `llms.txt`, Open Graph, Twitter image, and JSON-LD behavior.
- Do not invent customer logos, fake usage metrics, or fake confidence percentages.
- Do not hand-write plan quotas in page JSX; read the shared plan source.
- Do not create a parallel color system for severity, verdict, evidence, or score state.
- Public pages must use shared marketing chrome and have no `href="#"` links.
- Product pages must prefer dense ledgers, text equivalents, keyboard access, and no color-only severity signal.
- Verification command set: `npm run type-check`, `npm run build`, and Playwright smoke/e2e where practical.

---

### Task 1: Foundation And Reset Tokens

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/rvx/surface.tsx`

**Interfaces:**
- Consumes: Tailwind token variables in `globals.css`
- Produces: RVX layout primitives `RvxSection`, `RvxPanel`, `RvxStat`, `RvxLedger`

- [ ] Replace scattered visual comments and partially overlapping token groups with a single documented token map: canvas, surface, inset, border, focus, source, transform, sink, patch, verify, severity, verdict, score, chain.
- [ ] Keep `.light` and `.dark` complete for every token family.
- [ ] Keep Inter and JetBrains Mono only; ensure no serif fallback appears in display classes.
- [ ] Add `surface.tsx` primitives that only compose class names and semantic HTML, so pages can share rhythm without importing page-specific state.
- [ ] Run `npm run type-check`.

### Task 2: Marketing System Restart

**Files:**
- Modify: `frontend/src/components/marketing/marketing-shell.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: public SEO route pages under `frontend/src/app/{blog,compare,detections,glossary,vulnerabilities,vulnerable-repos,tools,privacy,terms,changelog}/`
- Modify: `frontend/src/components/marketing/plan-table.tsx`

**Interfaces:**
- Consumes: `PlanTable`, `SignalSpine`, SEO data modules under `frontend/src/lib/seo/*`
- Produces: shared public chrome and a homepage whose hero is the product, not a landing-page template

- [ ] Rebuild `MarketingShell` as one sticky navigation with product, solutions, resources, pricing, docs, auth actions, mobile disclosure, and real footer links.
- [ ] Rebuild the homepage around a real RepoVeriX evidence chain: hero, live product frame, evidence loop, capability ledger, integrations, pricing, FAQ, final CTA.
- [ ] Add responsive media slots for product screenshots/video placeholders using compressed, lazy-loaded assets or CSS-only product frames until real media exists.
- [ ] Ensure all public route wrappers use `MarketingShell` and no page contains dead `#` navigation.
- [ ] Preserve FAQ JSON-LD and route metadata.
- [ ] Run `npm run type-check`.

### Task 3: Auth And Onboarding Restart

**Files:**
- Modify: `frontend/src/components/auth-shell.tsx`
- Modify: `frontend/src/app/auth/login/page.tsx`
- Modify: `frontend/src/app/auth/signup/page.tsx`
- Modify: `frontend/src/app/onboarding/page.tsx`
- Modify: `frontend/src/components/oauth-buttons.tsx`

**Interfaces:**
- Consumes: `useAuth`, OAuth routes, existing form schemas and backend error semantics
- Produces: one branded auth shell, consistent form surfaces, and onboarding that points to the first repository import

- [ ] Rebuild `AuthShell` so auth pages feel like the same product as the marketing and app shells.
- [ ] Keep validation and backend error handling intact.
- [ ] Replace decorative panels with a product proof rail: source, evidence, patch, verify.
- [ ] Rebuild onboarding as a first-run command center with import, scan, review, verify steps.
- [ ] Run auth-related tests or Playwright smoke if available.

### Task 4: Product Shell And Navigation Restart

**Files:**
- Modify: `frontend/src/components/rvx/console-shell.tsx`
- Modify: `frontend/src/components/rvx/nav-model.ts`
- Modify: `frontend/src/app/(app)/layout.tsx`
- Modify: `frontend/src/components/app/command-palette.tsx`

**Interfaces:**
- Consumes: `useAuth`, `useRepositories`, `useDashboardSummary`, `useScans`, route model
- Produces: condensed app shell with command search, repository context, live scan telemetry, mobile bottom nav, and accessible navigation drawer

- [ ] Keep the extracted `ConsoleShell` boundary.
- [ ] Rework shell chrome into a cleaner top telemetry bar, left icon rail, repository context strip, command palette affordance, and mobile bottom nav.
- [ ] Ensure the shell never crashes on malformed list payloads.
- [ ] Ensure all primary app routes are reachable from keyboard and mobile.
- [ ] Run `npm run type-check`.

### Task 5: Core Product Pages

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`
- Modify: `frontend/src/app/(app)/findings/page.tsx`
- Modify: `frontend/src/app/(app)/findings/[id]/page.tsx`
- Modify: `frontend/src/app/(app)/scans/new/page.tsx`
- Modify: `frontend/src/app/(app)/scans/[id]/page.tsx`

**Interfaces:**
- Consumes: `useDashboardSummary`, `useFindings`, `useScans`, `useRepositories`, `SignalSpine`, `SeverityBadge`, `VerdictBadge`
- Produces: dashboard, findings explorer, finding detail, scan launcher, and scan detail that all use the same evidence vocabulary

- [ ] Rebuild dashboard as risk landscape, investigation queue, live analysis, repository activity, and next action.
- [ ] Rebuild findings list as a dense filterable ledger with severity, verdict, repository, location, and first-seen columns.
- [ ] Decompose finding detail around verdict header, evidence spine, impact, patch, verification timeline, feedback.
- [ ] Rebuild scans pages around source selection, analysis depth, pipeline progress, and honest failure states.
- [ ] Run `npm run type-check`.

### Task 6: Deep Product And Account Pages

**Files:**
- Modify repository detail routes under `frontend/src/app/(app)/repositories/[id]/`
- Modify: `frontend/src/app/(app)/repositories/page.tsx`
- Modify: `frontend/src/app/(app)/websites/page.tsx`
- Modify: `frontend/src/app/(app)/websites/[id]/page.tsx`
- Modify: `frontend/src/app/(app)/pull-requests/page.tsx`
- Modify: `frontend/src/app/(app)/pull-requests/[id]/page.tsx`
- Modify: `frontend/src/app/(app)/billing/page.tsx`
- Modify: `frontend/src/app/(app)/team/page.tsx`
- Modify: `frontend/src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: existing hooks and data contracts for repositories, websites, pull requests, billing, team, settings
- Produces: aligned secondary app surfaces with shared page headers, ledgers, panels, empty states, and plan data

- [ ] Rebuild repository overview and subviews so each view answers one question.
- [ ] Rebuild PR review around changed files, risk classification, findings, proof request, suggested fix.
- [ ] Rebuild website audits with their own audit timeline and evidence path.
- [ ] Rebuild billing on shared plan data and usage bars.
- [ ] Rebuild team/settings as tabbed operational pages.
- [ ] Run `npm run type-check`.

### Task 7: SEO, Media, Motion, And Verification

**Files:**
- Modify: `frontend/src/app/sitemap.ts`
- Modify: `frontend/src/app/opengraph-image.tsx`
- Modify: `frontend/src/app/twitter-image.tsx`
- Modify: `frontend/e2e/*.spec.ts` only when copy contracts intentionally change
- Create or modify media assets under an appropriate frontend asset path

**Interfaces:**
- Consumes: public route registry, metadata helpers, Playwright config
- Produces: final SEO polish, social images, compressed media, motion polish, accessibility checks

- [ ] Audit metadata for homepage, SEO hubs, dynamic SEO pages, docs/help, and auth pages.
- [ ] Add or refresh Open Graph/Twitter visuals to match the new RVX console identity.
- [ ] Add compressed product media where real assets exist; otherwise use live product frames rather than stock imagery.
- [ ] Verify reduced motion, focus order, mobile overflow, and no color-only severity.
- [ ] Run `npm run type-check`, `npm run build`, and Playwright smoke/e2e where environment permits.

## Self-Review

- Spec coverage: The tasks cover the blueprint defects, public marketing shell, homepage, auth, app shell, core product, deep product/account pages, SEO, media, motion, and verification.
- Placeholder scan: No task uses TBD/TODO/later language; each task names files and concrete outcomes.
- Type consistency: RVX primitive names are defined in Task 1 and consumed by later tasks; data contracts remain in existing hooks and API types.
