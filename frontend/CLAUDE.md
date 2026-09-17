# CLAUDE.md — RepoVeriX Frontend Design Guidance

This file provides guidance to Claude Code when working with UI in the RepoVeriX frontend.
RepoVeriX is a Next.js 14 application using Tailwind CSS, Radix UI primitives, lucide-react,
and ReCharts. It has an established design system — see "Existing Design System" below.

## Design Loop (follow in order)

1. **PLAN with data — `ui-ux-pro-max`.** Before writing markup, get a concrete design
   system. Run the generator, then pull specifics per surface:
   ```bash
   python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "RepoVeriX"
   python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain style|color|typography|ux|landing|chart|react
   python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack nextjs
   ```
   Use it for: product-type patterns, color tokens, font pairings, UX anti-patterns,
   landing structure, React/Next.js performance patterns, and per-stack implementation guidance.
   Treat its output as the source of truth for tokens (color, type, spacing).

2. **COMMIT to an aesthetic — `frontend-design`.** Do not sample the safe center of the
   training distribution. Answer four questions first — *purpose, tone, constraints,
   differentiation* — pick ONE tone and execute it precisely. Avoid the three AI-slop
   defaults (cream + serif + terracotta; near-black + acid accent; hairline broadsheet)
   unless the brief explicitly asks. Spend boldness in **one** signature element; keep the
   rest quiet.

3. **BUILD.** Implement with the chosen tokens. Match the surrounding code's conventions.
   For a component-driven React/Next.js stack, use the **shadcn** MCP to search/add
   components instead of hand-rolling primitives.

4. **SEE IT — Playwright / Chrome DevTools MCP.** You are not done when the code compiles.
   Open the page in a real browser, screenshot it, read the console, exercise interactive
   states (hover, focus, open menus, submit forms), and resize the viewport. Fix what you
   see — z-index, animation timing, layout shift, overflow. This feedback loop is the whole
   point of the stack; a change you have not looked at is not finished.

5. **REVIEW — `/design-review` (the `design-review` subagent).** Before you call a UI change
   complete, run the design-review subagent. It drives Playwright across mobile→ultrawide
   viewports, checks WCAG 2.1 AA (contrast, focus order, keyboard traps), responsive
   integrity, and interaction states, and returns ranked findings. Fix Blocker/High
   findings before finishing.

## Existing Design System

RepoVeriX's frontend already has a coherent design system baked into `src/app/globals.css`
and `tailwind.config.ts`:

- **Fonts** (self-hosted via `next/font`):
  - `Inter` → body/UI (`--font-inter`)
  - `Fraunces` → display headings (`--font-display`, warm editorial serif)
  - `JetBrains Mono` → code, diffs, identifiers (`--font-mono`)
- **Color palette** (HSL tokens, warm editorial):
  - `--primary: 14 63% 52%` (warm clay), `--secondary: 40 28% 93%`
  - `--background: 40 33% 97%` (light) / `25 20% 8%` (dark)
  - `--foreground: 25 18% 12%` (light) / `40 30% 96%` (dark)
- **Components:** Radix UI primitives via `@radix-ui/react-*`, `sonner` for toasts,
  `lucide-react` for icons, `recharts` for charts
- **Motion:** Custom `page-enter` and `fade-slide` keyframes with `cubic-bezier(0.16, 1, 0.3, 1)`
- **Accessibility:** `prefers-reduced-motion` respected, dark/light toggle, cookie consent banner

When designing new UI, reuse these tokens and conventions. Consult the `ui-ux-pro-max` skill
for additional patterns, but always align with the existing system.

## Quality Floor (never ship below this)

- **Responsive:** no horizontal scroll at 375 / 768 / 1024 / 1440 px; content reflows, not shrinks.
- **Accessible:** visible `:focus-visible` on every interactive element; WCAG AA contrast
  (4.5:1 text, 3:1 large text / UI); semantic landmarks; labelled controls; `prefers-reduced-motion` respected.
- **Performant:** stable layout (no CLS from unsized media/fonts), lazy-load below-fold
  images, `font-display: swap`, avoid render-blocking. Check against the `web-vitals` domain.
- **Intentional copy:** active voice, sentence case, name things by what users recognize.

## What's Wired In

| Layer | Tool | Where |
|-------|------|-------|
| Knowledge | `ui-ux-pro-max` skill | `.claude/skills/ui-ux-pro-max/` (locally bundled, no install needed) |
| Taste | `frontend-design` plugin | install via `/plugin install frontend-design@anthropics/claude-code` |
| Components | `shadcn` MCP | `.mcp.json` |
| Visual feedback | `@playwright/mcp` + `chrome-devtools-mcp` | `.mcp.json` |
| Automated review | `design-review` subagent + `/design-plan` & `/design-review` commands | `.claude/agents`, `.claude/commands` |
| Standalone audit | `scripts/design-audit.mjs` (multi-viewport screenshots) | `scripts/`, CI in `.github/workflows` |

## Available Skills

All skills from the [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) repository are available:

| Skill | Purpose | Key Scripts |
|-------|---------|-------------|
| `ui-ux-pro-max` | Core knowledge base: 79 styles, 192 palettes, 74 font pairings, 25 charts, 22 stacks | `scripts/search.py` |
| `ui-styling` | Tailwind CSS + shadcn/ui component styling | `scripts/tailwind_config_gen.py`, `scripts/shadcn_add.py` |
| `design` | Unified design: brand, tokens, UI, logo, CIP, banners, social photos, icons | `scripts/logo/generate.py`, `scripts/cip/generate.py`, `scripts/icon/generate.py` |
| `design-system` | Token architecture, component specs, slide generation | `scripts/generate-tokens.cjs`, `scripts/search-slides.py` |
| `brand` | Brand voice, visual identity, messaging, asset management | `scripts/inject-brand-context.cjs`, `scripts/sync-brand-to-tokens.cjs` |
| `banner-design` | Multi-format banner design (social, ads, web, print) | `references/banner-sizes-and-styles.md` |
| `slides` | Strategic HTML presentations with Chart.js | `references/layout-patterns.md`, `references/html-template.md` |

### Quick Reference

- **Design tokens:** `python .claude/skills/design-system/scripts/generate-tokens.cjs --config tokens.json -o tokens.css`
- **Brand context injection:** `node .claude/skills/brand/scripts/inject-brand-context.cjs`
- **Banner design:** Read `.claude/skills/banner-design/references/banner-sizes-and-styles.md` for platform sizes
- **Slide creation:** `python .claude/skills/design-system/scripts/search-slides.py "<topic>"`
- **Logo generation:** `python .claude/skills/design/scripts/logo/generate.py --brand "Name" --style minimalist`

## Notes

- The `ui-ux-pro-max` skill is already installed at `.claude/skills/ui-ux-pro-max/`. Run its
  search script with: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>`
- On Windows, use `python` instead of `python3`.
- Optional: 21st.dev **Magic** MCP (`@21st-dev/magic`) generates React components from a
  prompt but needs an API key — see `docs/SETUP.md`. It is intentionally left out of the
  default `.mcp.json` so the stack works with zero secrets.
- Run `npm run audit -- --url http://localhost:3000` for a fast heuristic pass, or
  `npm run audit -- --file ./index.html` for a static file.