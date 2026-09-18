# RepoVeriX — Frontend UI/UX Master Blueprint

**Status:** design direction, grounded in a full audit of the current repo.
**Scope:** marketing site + authenticated product, as one visual system.
**Rule for this document:** every claim below was checked against the working tree, not assumed.

---

## 0. How to read this

The product is not a blank slate. It already has:

- **68 routes** / ~14,140 lines of page code
- a **rich semantic token layer** (severity, finding state, score bands, evidence chain)
- real primitives (`components/ui/*`, `components/system/*`)
- a mostly-built app shell (collapsible sidebar, repo switcher, command palette, mobile nav)
- an **e2e suite that describes the target design** and is currently red

So this is a **calibration and completion job**, not a greenfield redesign. Section 3 lists the
verified defects; sections 4–14 define the system; section 15 gives the single implementation prompt.

---

## 0.1 Implementation status

Landed in this pass:

- **Phase 0 — complete.** Real `.light` token layer (surface *and* semantic four-face); the
  Fraunces serif removed from `layout.tsx`, `globals.css` and the Tailwind font stack;
  `themeColor` regenerated from the real palette; radius scale made monotonic and tokenized;
  the hero's secondary CTA now targets a real section; `/team/security` exists.
- **Phase 1 — complete.** `lib/plans.ts` (single plan source), `SeverityBadge` + `SeverityMeter`,
  `VerdictBadge` + `ScanStatusBadge`, `DataTable`, `RepoCard`, `ScanProgress`, `MetricDelta`,
  `PlanTable`. Existing `EmptyState`, `CodeViewer`/`DiffViewer`, `PageHeader` and `Table` were
  reused rather than rebuilt.
- **Phase 2 — complete.** `MarketingShell` is live on every public route: the homepage,
  `/tools`, `/integrations/{github,gitlab}`, `/privacy`, `/terms`, `/changelog`, the six SEO
  hubs (`/compare`, `/detections`, `/glossary`, `/vulnerabilities`, `/vulnerable-repos`,
  `/blog`) and all six dynamic detail routes. Every bespoke copy of the nav and footer is gone,
  and no link on a public page points at `#`.
- **Phase 3 — complete.** Homepage rebuilt to the section order below, grounded in the real
  `vulnerable_app` fixture and `RVX-SQLI-001`; adds the FAQ section and its `FAQPage` JSON-LD
  the layout had claimed existed; `PlanTable` replaces the hand-written pricing copy.
- **Phase 4 — findings list rebuilt.** The list is a `DataTable` (sortable per column, mobile
  column hiding, real empty state). The old hand-rolled grid printed severity twice, and the
  second copy collapsed medium/low/info into one grey chip — that duplicate is deleted and a
  Repository column (resolved scan → repository) takes its place. The dashboard lost its local
  copy of the severity ramp, prints distribution through `SeverityMeter`, and renders its bars
  with `.state-*` tokens.
- **Phase 5/6 — alignment pass.** `ScanProgress` is wired into the scan detail page over the
  real `analysis_runs`. The audit page, PR detail, repositories list and app-shell findings
  badge moved from raw `bg-red-500/10`-style classes onto the `.sev-*` / `.state-*` tokens,
  and every bespoke page `h1` was replaced by the shared `type-page-title` / `type-lead` /
  `type-display` steps (a new `.type-lead` step was added so marketing sub-page titles keep
  their size instead of shrinking).
- **Verification.** `tsc --noEmit` clean; all 30 smoke tests pass on chromium-desktop and
  chromium-mobile, including the hero assertion that was red before this pass; every public
  route returns 200; the shipped CSS contains the `.light` blocks and the monotonic radius
  tokens and no longer contains any serif fallback.

Still open, honestly: the deep **decomposition** of the three largest pages (`audit` 902 lines,
`findings/[id]` 746, `research` 664) into the section 8 primitives — they are token-aligned now
but their internal structure is unchanged; the repository graph/architecture diagrams still
lack text equivalents for the visualisations; and the micro-interaction spec (chain stagger,
row enter) is only partly implemented, since `prefers-reduced-motion` handling and the
route-change `animate-page` were already in place.

---

## 1. Audit — what actually exists

### 1.1 Route inventory (68 `page.tsx` files)

**Authenticated app — 23 routes** (all under `src/app/(app)/`)

| Area | Routes |
| --- | --- |
| Workspace | `/dashboard`, `/repositories`, `/repositories/new` |
| Repository detail (7 sub-views + overview) | `/repositories/[id]`, `/audit`, `/graph`, `/intelligence`, `/history`, `/regression`, `/research` |
| Analysis | `/scans`, `/scans/new`, `/scans/[id]`, `/findings`, `/findings/[id]` |
| Websites | `/websites`, `/websites/[id]`, `/websites/[id]/history` |
| Review | `/pull-requests`, `/pull-requests/[id]` |
| Account | `/team`, `/billing`, `/settings` |

**Public / marketing / SEO — 45 routes**

| Cluster | Count | Notes |
| --- | --- | --- |
| Auth | 6 | login, signup, forgot/reset password, verify-email, oauth/callback |
| Docs | 9 | getting-started, concepts, features, configuration, api, research, account-security, faq + index |
| Help | 9 | get-started, features, api, billing, security, troubleshooting, community, contact + index |
| Programmatic SEO | 8 | `detections/[rule]`, `glossary/[term]`, `vulnerabilities/[slug]`, `vulnerable-repos/[name]`, `compare/[slug]` + indexes |
| Integrations | 2 | github, gitlab |
| Editorial | 3 | blog, `blog/[slug]`, changelog |
| Conversion | 2 | `/` (home), `/onboarding` |
| Utility | 4 | `/tools`, `/share/[token]`, `/privacy`, `/terms` |

Generated from data modules: `src/lib/seo/{rules,vulnerabilities,glossary,comparisons,repos}.ts`.

### 1.2 Heaviest surfaces (maintenance risk)

```
902  repositories/[id]/audit          664  repositories/[id]/research
746  findings/[id]                    588  repositories/[id]/intelligence
522  settings                         450  scans/[id]
419  dashboard                        410  pull-requests/[id]
```

The audit and finding-detail screens are the two largest files in the app. They are the product's
core value, and they are also the least systematic. Both should be decomposed into the primitives
in section 8 before any visual polish.

### 1.3 What is already good (inherit, do not replace)

**Semantic tokens in `globals.css`** are genuinely strong. Every token ships four faces —
solid hue, `-fg` text on solid, `-soft` tinted surface, `-ink` text on tint — tuned for AA:

- **Severity ramp:** `--sev-critical|high|medium|low|info` (+ fg/soft/ink)
- **Finding states:** `--state-verified|probable|rejected|observed|recommendation|insufficient`
- **Score bands:** `--band-strong|moderate|weak|unknown`
- **Evidence chain:** `--chain-line|node|node-soft|node-ink`
- **Utility classes:** `.chip`, `.chip-lg`, `.chip-outline`, `.mono-label`, `.data-row`,
  `.score-meter`, `.chain-node(-lg|-active)`, `.sev-*`, `.state-*`, `.band-*`

**Components to reuse rather than rebuild:**

`system/evidence-chain.tsx`, `system/code.tsx`, `system/page-header.tsx`, `system/status.tsx`,
`system/verification-timeline.tsx`, `audit/evidence-graph-diagram.tsx`, `audit/risk-gauge.tsx`,
`intelligence/{architecture-diagram,architecture-smells,health-timeline,query-console}.tsx`,
`findings/{finding-chat,impact-panel,patch-quality-badge,proof-of-fix}.tsx`,
`app/command-palette.tsx`, `app/onboarding-checklist.tsx`.

**App shell** (`(app)/layout.tsx`, 739 lines) already delivers: skip link, collapsible sidebar with
persisted state, workspace switcher, repository switcher with repo sub-view grid, sticky top bar,
`⌘K` palette, repo context strip, mobile bottom nav with findings badge, upgrade-toast listener.
This is closer to the target than the brief assumed — it needs consistency, not replacement.

**The e2e suite is the spec.** `e2e/smoke.spec.ts` already asserts the *intended* homepage:

```ts
await expect(page.getByRole('heading', { name: /repository intelligence/i })).toBeVisible();
await expect(page.getByText(/follow the evidence|shows its work|verify the fix/i).first()).toBeVisible();
```

That heading does not exist yet on `/`. The tests were written for the design, before the design.
**Treat `e2e/*.spec.ts` as the acceptance criteria for this work** (see section 13).

---

## 2. What is already in flight

The working tree contains an **uncommitted, partially-applied redesign** that I did not author:

- `globals.css` rewritten to a cool graphite palette (417 lines changed) with explicit
  "no more serif" comments and a `--font-display` that now points at a sans stack
- `tailwind.config.ts` gained `font-display`
- Homepage reduced to 558 lines (was ~1,700) — a first pass at the new architecture
- `dashboard`, `findings`, `findings/[id]`, `repositories`, `websites`, `websites/[id]`,
  `signup` rewritten; `button`/`card`/`badge` touched
- `e2e/auth-flows.spec.ts` and `e2e/product-flows.spec.ts` added

**Consequence:** do not re-run a from-scratch migration. The next step is to **close the gap**
between this partial state and the target — starting with section 3, because several defects are
cheap and currently visible to users.

---

## 3. Verified defects (fix before anything cosmetic)

These are confirmed in the working tree. Each undermines the "premium platform" impression directly.

### D1 — Light theme is broken (high)

`ThemeProvider` toggles `.light` / `.dark` on `<html>`:

```ts
root.classList.toggle('dark', theme === 'dark');
root.classList.toggle('light', theme === 'light');
```

`globals.css` defines `:root` (dark values) and `.dark` (dark values). **There is no `.light`
block anywhere** — the only stylesheet in the app is `globals.css`.

**Effect:** selecting light mode renders the dark palette. The toggle is decorative, and
`smoke.spec.ts` has a "keyboard + theme" test covering it.
**Fix:** either author a real `.light` token block (all `--sev-*`, `--state-*`, `--band-*`,
`--chain-*`, surface and text tokens) or remove the toggle. Given the theme toggle is already
wired, advertised, and tested, authoring light is the better call.

### D2 — Typography is split-brain; the serif is still live (high)

- `src/app/layout.tsx` still loads **Fraunces** and assigns it to `--font-display`
- `globals.css` base: `h1 { font-family: var(--font-display), Georgia, 'Times New Roman', serif; }`
- `globals.css` class: `.font-display { font-family: var(--font-inter), … }`
- CSS comments contradict each other: *"Page titles get Fraunces — the warm, editorial RepoVeriX mark"*
  sits directly above the new *"no more serif"* rationale

**Effect:** every `<h1>` is serif while everything using `.font-display` is sans. The brief's
central typographic note — the editorial serif fights the product category — is only half applied.
**Fix:** pick one. Recommendation in section 5 (all-sans, no new font dependency).

### D3 — Stale warm `themeColor` (medium)

`layout.tsx` still declares the pre-redesign palette:

```ts
{ media: '(prefers-color-scheme: light)', color: '#faf7f2' },
{ media: '(prefers-color-scheme: dark)',  color: '#171310' },
```

Warm cream / warm brown, against a cool graphite token set (`220 15% 8%`). This paints the browser
chrome on mobile, and it is the first color a user sees.
**Fix:** regenerate from the real tokens once D1 is settled.

### D4 — Radius scale is inverted (medium)

```ts
borderRadius: {
  lg: 'var(--radius)',              // 0.5rem
  md: 'calc(var(--radius) + 2px)',  // 0.5625rem  ← larger than lg
  sm: 'calc(var(--radius) - 2px)',  // 0.4375rem
}
```

`md > lg` breaks Tailwind's size ordering, so `rounded-lg` is visually *tighter* than `rounded-md`.
Components already disagree: buttons use `rounded-md`, cards use `rounded-lg`, the shell mixes
`rounded-lg`/`rounded-xl`, and the token layer added a fourth, non-tokenized `rounded-xl`.
**Fix:** make the scale monotonic and re-point primitives at it (section 6.3).

### D5 — Dead hero CTA (medium)

The homepage hero renders `<a href="#demo">View demo</a>`. The page contains exactly one anchor
target, `id="pricing"`. There is no `#demo`.
**Effect:** the secondary hero CTA does nothing. In the brief's own words, this is the button that
should open the *real product*, which makes it doubly worth fixing.

### D6 — Marketing pricing contradicts the enforced billing config (high)

The homepage advertises **Team = "Custom" price, "Unlimited scans", "Contact sales"**.
`backend/app/services/billing.py` is the source of truth:

| Plan | Price | Repos | Scans/mo | Fixes | Verifications | Website audits | Collab |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Free | $0 | 3 | 5 | 2 | 2 | 10 | 1 |
| Pro | $29 | 20 | 60 | 30 | 30 | 100 | 1 |
| **Team** | **$99** | **100** | **400** | 200 | 200 | 500 | 5 |

Team is a **purchasable Stripe plan** (`STRIPE_PRICE_IDS` maps it), not "custom". "Unlimited scans"
is false. The homepage also silently omits the 3-repo Free cap, the 20-repo Pro cap, website-audit
quotas, and the fix/verification quotas — and `/billing` already renders the correct numbers.
**Fix:** render pricing from a single shared plan source; never hand-write plan facts in JSX.

### D7 — Sidebar links to a route that does not exist (high)

`(app)/layout.tsx` nav contains:

```ts
{ section: 'Team', items: [
  { name: 'Team & Orgs', href: '/team', icon: Users },
  { name: 'Security Center', href: '/team/security', icon: ShieldCheck },
]}
```

`src/app/(app)/team/` contains only `page.tsx`. **"Security Center" is a permanent 404** for every
user, in the primary navigation.

### D8 — No shared marketing chrome; dead footer links (medium)

Nav and footer are **inlined in `src/app/page.tsx`**. Only three files own a footer at all:
`page.tsx`, `docs/layout.tsx`, `tools/catalog.tsx`. The other ~42 public routes have no shared
shell, so their chrome drifts or vanishes.

The inlined footer also ships dead links: `{ name: 'Features', href: '#' }` and
`{ name: 'About', href: '#' }`.
**Fix:** a single `MarketingShell` (section 7.1) with a real link registry.

### D9 — Fabricated proof in the hero (medium)

The hero panel is an invented dashboard: `confidence: 94 / 87 / 98` on three findings, plus a
hand-rolled three-step "evidence chain". Two problems:

1. RepoVeriX's real vocabulary is `VERIFIED` / `PROBABLE` / `REJECTED` / `OBSERVED` plus evidence
   chains — **"94% confidence" is not a product concept** and contradicts `lib/verdict.ts`.
2. The chain is reimplemented inline while `system/evidence-chain.tsx` and the `.chain-node` tokens
   exist. The marketing surface is guaranteed to drift from the product it depicts.

Also present: *"Trusted by security teams"* with no logos, no names, no numbers.
**Fix:** section 7.2 — and per the brief, cut unbacked social proof until it is real.

---

## 4. Design personality

**Dark-first. Product-led. Evidence as the signature.**

```
Background        hsl(220 15% 8%)     Surface      hsl(220 12% 12%)
Surface elevated  hsl(220 12% 16%)     Border       hsl(220 10% 22–24%)
Text              hsl(220 15% 95%)     Secondary    hsl(220 10% 60–70%)
Primary (blue)    hsl(220 85% 48–58%)  Verified     hsl(150 65–70% 50–55%)
Probable          hsl(50 85–90% 50–55%)  Critical   hsl(0 80–85% 55–60%)
```

These are the **existing** tokens. The brief proposed an 8-hex palette; the repo already has a
superset that is contrast-tuned in four faces. **Do not introduce parallel color values** — that is
how D9-style drift starts.

**Editorial correction to the brief's palette:** the semantic layer is the design system. The only
genuine gap is the *primitive* layer (radius, spacing, elevation, motion, type) — section 6.

Signature elements, in priority order:

1. **Evidence chains** — source → transform → sink, rendered as a chain, reusable everywhere
2. **Verdict vocabulary** — VERIFIED / PROBABLE / REJECTED / OBSERVED, never "confidence: 94%"
3. **Thin borders, dense but calm tables**
4. **Real product UI on marketing pages** — the product is the marketing
5. **Monospace for identifiers, paths, diffs, and rule IDs** (`.mono-label`)

Explicitly rejected: hooded figures, glowing shields, circuit backgrounds, stock security imagery,
decorative AI gradients, fake metrics, fake logo walls, oversized rounded cards.

---

## 5. Typography

**Decision: one sans family, two roles, plus mono.** Zero new font dependencies.

| Role | Family | Treatment |
| --- | --- | --- |
| Display (`h1`–`h2`) | Inter | `font-weight: 700`, `letter-spacing: -0.03em` |
| UI / body | Inter | inherited, `font-optical-sizing: auto` |
| Technical | JetBrains Mono | `label`, code, paths, rule IDs, counts |

Inter and JetBrains Mono are **already loaded** via `next/font/google`. Geist is a plausible future
upgrade, but it is not currently a dependency and adds risk for a marginal gain — revisit only if
Inter proves limiting.

**Required cleanup (D2):**

1. Delete the `Fraunces` import, its `variable`, and its `<body>` class from `layout.tsx`
2. Drop the `h1 { font-family: var(--font-display), Georgia, serif }` base rule
3. Make `--font-display` resolve to the Inter stack, or delete the variable and have `.font-display`
   read `var(--font-inter)` directly — **one source, not two**
4. Delete the contradictory "Page titles get Fraunces" comment
5. Make h1–h6 use tight tracking, no serif fallback anywhere in the stack

Type scale (already partly in `globals.css` as `.type-*` classes — formalize and use them):

```
.type-display     clamp-ish: text-4xl → sm:text-5xl, bold, tight
.type-page-title  text-2xl → sm:text-3xl
.type-section     text-base font-bold
.type-body        text-sm (dense surfaces) / text-base (prose)
.type-meta        font-mono text-[11px] uppercase tracking-[0.08em]  → .mono-label
```

---

## 6. Primitive layer (the actual gap)

### 6.1 Spacing

Adopt a 4px base with a restricted set: `1, 2, 3, 4, 6, 8, 12, 16, 20, 24` (Tailwind units).
Dense surfaces use `gap-2`/`py-2`/`px-3`; page padding is `px-4 sm:px-6 lg:px-10` (already in the
shell). Do not invent intermediate values.

### 6.2 Elevation

Three levels, borders first. No large diffuse shadows.

```
flat      border border-border/60
raised    border + shadow-sm                 (top bar, sticky headers)
overlay   border + shadow-lg + backdrop-blur (palette, dropdowns, sheets)
```

### 6.3 Radius (fixes D4)

Monotonic, tokenized, and used consistently:

```
--radius-sm  6px    chips, inputs, small buttons
--radius-md  8px    buttons, cards, table containers   ← default
--radius-lg  10px   panels, modals, the top bar
--radius-xl  12px   large panels, sheets (unchanged from today's look)
--radius-2xl 16px   hero / product frames (unchanged from today's look)
--radius-full       avatars, dots, pills
```

Then sweep primitives and the shell to remove `rounded-xl` ad-hoc usage where a token fits.

### 6.4 Motion

```
page-enter   0.35s cubic-bezier(0.16, 1, 0.3, 1)   (exists: .animate-page)
row/detail   0.15s ease                            (exists: .data-row)
chain step   stagger 0.04s, once, in-view only
hover        colors/borders only — never layout shift
```

Respect `prefers-reduced-motion` (already handled globally). No parallax, no autoplay, no
scroll-jacking. Marketing pages may reuse the existing `ScrollReveal`.

### 6.5 Component hierarchy

**Exists — reuse:** Button, Card, Badge, Dialog, DropdownMenu, Form, Input, Label, Select, Separator,
Skeleton, State, Table, Tabs, Textarea, Tooltip, Avatar · PageHeader, Status, Code, EvidenceChain,
VerificationTimeline · RiskGauge, EvidenceGraphDiagram · ArchitectureDiagram, ArchitectureSmells,
HealthTimeline, QueryConsole · FindingChat, ImpactPanel, PatchQualityBadge, ProofOfFix ·
CommandPalette, OnboardingChecklist.

**To build:**

```
MarketingShell        nav + footer + link registry (fixes D8)
ProductFrame          device-framed, real-UI product screenshot wrapper
PlanTable             renders plans from ONE shared source (fixes D6)
EvidenceChainStrip    marketing-weight chain built on system/evidence-chain
DataTable             sort/filter/column-visibility/empty/loading (findings, scans, repos)
FindingRow            dense row: severity · title · repo · location · state · first seen
SeverityBadge         thin wrapper over .sev-* (kill bespoke badge markup)
VerdictBadge          thin wrapper over .state-*
RepoCard              repo + health score + last scan + open findings
ScanProgress          live pipeline states
DiffViewer            patch rendering for repairs/PR review
EmptyState            already partly in ui/state.tsx — make it the only path
MetricDelta           "+12 since last scan" style movement indicators
```

---

## 7. Marketing architecture

### 7.1 One shell for 45 public routes

Create `MarketingShell` (server component) and route every public page through it:
logo · Product · Solutions · Resources · Pricing · Docs · GitHub · `[Start free]`, plus a real footer
(Product / Solutions / Resources / Company / Legal / Status), and the mobile menu.

This is the single highest-leverage marketing change: it retires ~42 hand-rolled chromes, kills the
`href="#"` links, and makes nav/menu updates one edit.

Recommended nav grouping (progressive disclosure):

```
Product   → Code intelligence · Security analysis · Change risk · Attack paths
            Verified repairs · Evidence graph
Solutions → For developers · For security teams · For researchers · CI/CD
Resources → Docs · Tools · Detections · Glossary · Vulnerabilities · Compare · Blog · Changelog
```

### 7.2 Homepage — section by section

Narrative order (replaces the current six-section card stack):

1. **Hero** — eyebrow `REPOSITORY SECURITY INTELLIGENCE`; H1 in the brief's cadence
   (*Understand what changed. Prove what is risky. Verify what gets fixed.*), which also satisfies
   the `/repository intelligence/i` + evidence-loop assertions already in `smoke.spec.ts`.
   CTAs: `[Start free]` + `[Explore demo]` → a **real** target (fixes D5).
   Trust row: GitHub · GitLab · self-hosted · CI/CD — capability facts, not logos we do not have.
2. **The real product, immediately** — framed screenshot of the actual dashboard, with 3–4
   clickable hotspots driving a real finding's evidence chain. No invented numbers (fixes D9).
3. **The loop** — Analyze → Evidence → Verify → Ship, each with a real artifact:
   a rule ID, an evidence chain, a test result, a diff.
4. **Evidence, twice** — one worked example per claim: taint path; sanitizer-present false positive;
   patch with passing tests. Use `system/evidence-chain` so marketing and product cannot diverge.
5. **Capability proof** — repository intelligence, change risk, attack paths, architecture,
   Git intelligence, reviews, website audits. Show the surface, one line of why.
6. **Integrations** — GitHub, GitLab, any Git host, S3, ZIP, CI/CD.
7. **Pricing** — from the shared plan source; correct Team tier (fixes D6).
8. **FAQ** — keep the existing FAQPage JSON-LD pairing in `layout.tsx`.
9. **Closing CTA.**

Cut: "Trusted by security teams" until real, and every `href="#"`.

Note: every marketing surface must pass `expectNoOverflow(page)` at 390×844 — the suite already
enforces this.

### 7.3 Documentation consolidation (recommended, needs your call)

`/docs` (9 pages) and `/help` (9 pages) are two parallel documentation systems that overlap on
features, API, and billing. Three reference taxonomies also overlap: `/detections`,
`/vulnerabilities`, `/glossary`.

Recommendation: keep all URLs (SEO equity) but make `/docs` the canonical body and reduce `/help` to
genuinely support-shaped content (contact, community, troubleshooting), cross-linking into `/docs`.
Flagged as a decision, not an assumption — see the closing question.

---

## 8. Product surface design

### 8.1 Dashboard (`(app)/dashboard`, 419 lines)

Purpose: **what changed and what needs me**, not a metrics dump.
Order: scan/ingestion status strip → risk delta since last scan → critical/high queue (dense table,
real `FindingRow`) → health trend → repo grid → onboarding checklist while empty.
Rules: no giant cards; at most four summary figures; every number links to its filtered list.

### 8.2 Findings list (`(app)/findings`, 299 lines)

A real `DataTable`: columns `Finding · Severity · Repository · Location · State · First seen · Owner`,
with sort, filter by severity/state/repo, saved views, bulk triage, grouping, `⌘K` search.
Chips use `.sev-*` / `.state-*` only. Severity must never be conveyed by color alone — pair with
label or glyph.

### 8.3 Finding detail (`(app)/findings/[id]`, 746 lines — decompose first)

Target layout, top to bottom:
verdict header (state chip, severity, rule ID, repo, location) → **evidence chain** (the signature
artifact; source → transform → sink with excerpts) → counterexample/sanitizer analysis →
impact panel → candidate fix + diff → verification timeline (sandbox result) → feedback bar.
All four verdict states must be honest — `product-flows` Flow C asserts exactly this.
Reuse: `system/evidence-chain`, `system/verification-timeline`, `impact-panel`, `patch-quality-badge`,
`proof-of-fix`, `finding-feedback-bar`. Left column on desktop, stacked on mobile.

### 8.4 Scans (`/scans`, `/scans/new`, `/scans/[id]`)

`ScanProgress` with real pipeline stages and honest failure states; `/scans/new` is the
configure-and-launch surface (mode selection: static / LLM / hybrid / full — a real differentiator
worth surfacing here, not buried in docs).

### 8.5 Repository detail (7 sub-views)

Keep all seven; they are the platform's depth. Make the **repo context strip** in the shell the
canonical sub-nav (it already exists) and align each view to one question:

```
Overview      what is this repo's posture?
Audit         what changed in this diff/PR and what is at risk?
Evidence graph the attack path, visualized
Ask           natural-language questions over the codebase
Health history how posture moved over time
Regression    did we get worse?
Research      benchmark/reproducibility views
```

`/audit` (902 lines) and `/intelligence` (588) are decomposition targets before restyling.

### 8.6 PR review (`/pull-requests`, `/pull-requests/[id]`)

CodeRabbit-style: change summary → risk classification → findings inline on changed lines → proof
request affordance → suggested fix with diff. Visual weight on the review conversation and the
change stack, not on surrounding chrome.

### 8.7 Attack paths / Architecture / Evidence graph

Dark canvas, thin connectors, labeled nodes. Build on `evidence-graph-diagram.tsx` and
`architecture-diagram.tsx`; enforce keyboard access and a text fallback — these are the pages most
likely to be inaccessible.

### 8.8 Websites (`/websites`, `[id]`, `[id]/history`)

Distinct from repos: scores, audit history, findings. Give website audits their own severity/score
treatment and make the audit→findings→evidence path as tight as Flow D already asserts.

### 8.9 Settings / Team / Billing

`/settings` (522 lines) → tabbed sections. `/team` → members, roles, collaborators (respect the
`collaborators` limit). `/billing` → usage bars already exist and are correct; roll `PlanTable` out
of it so the homepage cannot drift again. Resolve D7 by **either** building `/team/security` or
removing the nav item — do not leave a 404 in primary nav.

---

## 9. Mobile

Breakpoints already used: `sm` 640, `lg` 1024, `xl` 1280. Contracts:

- Sidebar becomes an overlay drawer; bottom nav (5 slots, findings badge) is the primary nav
- All touch targets ≥ 44px; bottom nav already uses 56px
- `env(safe-area-inset-bottom)` respected (already done)
- Tables degrade to stacked definition rows with severity + title + location retained
- `expectNoOverflow(page)` must pass at 390×844 on every public route and the four flows

---

## 10. Accessibility (WCAG 2.2 AA)

Already present and to be preserved: skip link, `:focus-visible` outline, `aria-current`,
`role="switch"` theme toggle, `sr-only` labels, reduced-motion handling.

To enforce in new work: severity never color-only; the app is dark-first so verify light-theme
contrast once D1 lands; graphs and gauges need text equivalents; `⌘K` fully keyboard-driven.

---

## 11. Adoption order (phased)

```
Phase 0  Defects        D1 light tokens · D2 serif removal · D3 themeColor · D4 radius ·
                        D5 demo target · D7 404 nav item
Phase 1  Primitives     radius/spacing/type tokens · DataTable · SeverityBadge · VerdictBadge ·
                        EmptyState · PlanTable (+ D6 single plan source)
Phase 2  Shells         MarketingShell across 45 routes (D8) · align app shell to tokens
Phase 3  Homepage       sections 1–9 above; green the smoke spec
Phase 4  Core product   dashboard · findings list · finding detail
Phase 5  Depth          repo views · scans · PR review · graphs · websites
Phase 6  Account        settings · team · billing
Phase 7  Motion+a11y    micro-interactions, focus order, reduced-motion, graph fallbacks
```

Verification per phase: `npm run build` (or `tsc --noEmit`) plus the Playwright suite, and
`run_file_change_hooks` after edits.

---

## 12. Guardrails

1. Never write plan facts in JSX — read the shared plan source (cause of D6).
2. Never invent metrics, logos, or confidence numbers (cause of D9).
3. Never hand-roll severity/verdict markup — use the token classes and badge wrappers.
4. Never add a new color without extending the four-face token pattern.
5. Keep `e2e/*.spec.ts` green; when copy must change, update the assertion deliberately in the same
   change, never delete it.
6. Preserve JSON-LD, CSP nonces, and canonical metadata on every public route.

---

## 13. Test contracts (must stay green)

| Spec | Contract |
| --- | --- |
| `smoke.spec.ts` | hero `repository intelligence` heading + evidence-loop copy; `Start free`; `Tools` link; no overflow |
| `smoke.spec.ts` | `/tools` heading + `SARIF Export`; catalog search + empty state recovery; category tabs |
| `smoke.spec.ts` | auth pages: branded shell, password-match validation, forgot-password safety |
| `smoke.spec.ts` | logged-out: all app routes redirect to login; unknown website history fails honestly |
| `smoke.spec.ts` | keyboard tab order reaches primary actions; theme toggle |
| `auth-flows.spec.ts` | signup → dashboard → logout → protected redirect; duplicate email 409; disposable email rejected; invalid login inline error; rate-limit message; enumeration-safe reset |
| `product-flows.spec.ts` | **B** provider → repo → import → scan → findings (**C** finding → repair → Proof of Fix, verdict states honest, **D** website → audit → findings → evidence, **E** IDOR denial for repos/scans/findings/websites) |
| all | mobile 390×844 variants for Flows B–E |

Current status: **red** — at minimum the homepage hero heading, and the Flow B desktop/mobile runs
whose `test-results/` artifacts were present at session start. Phase 3 is what greens the hero.

---

## 14. Definition of done

A new visitor, before reading the second paragraph of the hero, should believe RepoVeriX is a funded
developer-security company — because the first thing they see is the real product showing a real
evidence chain. No fake numbers. No fake logos. No dead links. No 404s in nav. Pricing that matches
what the server enforces.

---

## 15. The single implementation prompt

Hand this to the coding agent. It is deliberately one prompt with a fixed order, so the system is
built bottom-up instead of page-by-page.

```text
Rebuild the RepoVeriX frontend around one design system, completing the partial redesign already
on disk. Do not start over: pages, tokens, components and e2e tests already exist and must be
preserved. Work in the phase order below and stop to report after each phase.

GROUND RULES
- Read docs/frontend-redesign-blueprint.md first. It lists verified defects D1–D9; fix each in the
  phase that owns it.
- Reuse the existing semantic token layer (--sev-*, --state-*, --band-*, --chain-*) and the
  components in src/components/system, /findings, /intelligence, /audit, /app. Do not introduce
  parallel colors or hand-rolled severity/verdict markup.
- Keep every route. Keep the strict CSP nonce flow, the JSON-LD blocks, and canonical metadata.
- e2e/smoke.spec.ts, e2e/auth-flows.spec.ts and e2e/product-flows.spec.ts are the acceptance
  criteria. Never delete an assertion; update it deliberately only when copy must change.
- After each phase run the build/typecheck and the Playwright suite, and report what is still red.

PHASE 0 — Defects
D1 Author real .light tokens in globals.css for every surface, text, sev, state, band and chain
   token so the existing theme toggle actually works; verify AA contrast in both themes.
D2 Remove Fraunces from layout.tsx and make display type all-sans from a single source; delete the
   h1 serif rule and the contradictory "Page titles get Fraunces" comment.
D3 Regenerate viewport themeColor from the real dark/light tokens.
D4 Make the radius scale monotonic and tokenized, then align primitives and the app shell to it.
D5 Point the hero's secondary CTA at a real in-page target.
D7 Build the /team/security screen or remove the nav item — no 404 in primary nav.

PHASE 1 — Primitives
Add the shared components named in the blueprint's component hierarchy (DataTable, SeverityBadge,
VerdictBadge, RepoCard, ScanProgress, DiffViewer, MetricDelta, EmptyState, EvidenceChainStrip).
Introduce one shared plan source so pricing copy and /billing read the same numbers (D6).

PHASE 2 — Shells
Create MarketingShell (nav + real footer + link registry) and route all public pages through it,
removing inlined chrome and every href="#" (D8). Align the authenticated shell to the tokens.

PHASE 3 — Homepage
Replace the homepage with the section order in the blueprint: hero (real product UI, no invented
metrics), evidence loop, worked evidence examples, capability proof, integrations, correct pricing,
FAQ, CTA. Green the smoke spec.

PHASE 4 — Core product
Rebuild dashboard, the findings DataTable and finding detail around the new primitives, preserving
the honest VERIFIED/PROBABLE/REJECTED/OBSERVED vocabulary and the evidence-chain signature.

PHASE 5 — Depth
Align repository views (overview, audit, evidence graph, ask, health history, regression, research),
scans, PR review, graphs and website audits to the system. Decompose the 700–900 line pages.

PHASE 6 — Account
Settings (tabbed), team, billing on the shared plan source.

PHASE 7 — Motion and accessibility
Apply the motion spec, ensure severity is never color-only, give graphs keyboard access and text
fallbacks, and verify keyboard order and reduced-motion across the app.
```
