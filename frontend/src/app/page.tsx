import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo, LogoMark } from '@/components/logo';
import { HeroRepoForm } from '@/components/hero-repo-form';
import { ScrollReveal } from '@/components/scroll-reveal';
import { getNonce } from '@/lib/csp-server';
import {
  ArrowRight,
  GitBranch,
  ScanSearch,
  Hammer,
  FlaskConical,
  Github,
  Gitlab,
  Cloud,
  UploadCloud,
  Check,
  Activity,
  GitCompare,
  Network,
  BookOpen,
  ShieldCheck,
  FileJson,
  GraduationCap,
  Workflow,
  TerminalSquare,
  GitPullRequest,
  ShieldAlert,
  Rocket,
  Building2,
  FlaskConical as FlaskIcon,
  Server,
} from 'lucide-react';

const navLinks = [
  { name: 'Product', href: '#product' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'Explore', href: '#explore' },
  { name: 'Docs', href: '/docs' },
  { name: 'Help', href: '/help' },
  { name: 'Research', href: '#research' },
];

const sources = [
  { icon: Github, label: 'GitHub', note: 'connect or URL' },
  { icon: Gitlab, label: 'GitLab', note: 'connect or URL' },
  { icon: Cloud, label: 'AWS S3', note: 'object or presigned link' },
  { icon: UploadCloud, label: 'ZIP upload', note: 'from your computer' },
  { icon: GitBranch, label: 'Any git host', note: 'Bitbucket, Azure, self-hosted' },
];

const capabilities = [
  {
    icon: Activity,
    title: 'Code health that shows its work',
    body: 'Every file gets a deterministic 1–10 score across defect risk, maintainability and performance — computed from 12 detectors, then drilled down to the exact line and a concrete next step.',
    bullets: ['Cyclomatic complexity & god classes', 'Duplicate-code clone detection', 'Ranked, actionable refactor plans'],
  },
  {
    icon: GitCompare,
    title: 'Change risk before the diff',
    body: 'Audit any branch or pasted diff: risk score from size, blast radius, health and history — with the callers your change may break and the tests you should run.',
    bullets: ['Blast-radius analysis over the call graph', 'Missing companion files from git history', 'PR-style directives: tests, co-changes, risky files'],
  },
  {
    icon: Network,
    title: 'Attack paths & evidence graphs',
    body: 'Trace untrusted input from source function to sink through the call graph, then check the claim: counterexample validation proves when a sanitizer blocks the path.',
    bullets: ['Source → transformation → sink chains', 'Proof-of-absence (counterexample) checks', 'Queryable evidence graph per scan'],
  },
  {
    icon: GitBranch,
    title: 'Git intelligence',
    body: 'Hotspots where defects actually hide, ownership and bus factor, co-change coupling — computed from real commit history, not vibes.',
    bullets: ['Recency-decayed churn × bug-fix signals', 'Per-file ownership → bus factor', 'Co-change pairs for safer edits'],
  },
  {
    icon: BookOpen,
    title: 'Auto-wiki & architecture',
    body: 'Structural documentation generated from symbols, imports and call relationships — with a layered architecture diagram and an LLM prose upgrade when you want it.',
    bullets: ['Per-file symbol & import inventory', 'Layered module diagram, no library needed', 'AI prose mode that degrades gracefully'],
  },
  {
    icon: ShieldCheck,
    title: 'Verified automated repair',
    body: 'The LLM proposes, the verifier decides. Candidate patches run your tests, static checks and a re-analysis in an isolated sandbox before a fix is certified.',
    bullets: ['Tests + static analysis + re-analysis', 'VERIFIED FIX / REJECTED verdicts', 'Regression tests generated per finding'],
  },
];

const workflows = [
  {
    icon: TerminalSquare,
    title: 'For auditors',
    body: 'Import a repository, get findings with evidence chains, confidence and counterexample checks — then export SARIF straight into GitHub Code Scanning or VS Code.',
  },
  {
    icon: Workflow,
    title: 'For CI & PR review',
    body: 'Run change audits on every pull request: risk score, blast radius, missing tests and companion files — deterministic evidence your reviewers can trust.',
  },
  {
    icon: GraduationCap,
    title: 'For researchers',
    body: 'Four experiment configurations (static-only, LLM-only, hybrid, full RepoVeriX), a benchmark dataset and evaluation scripts for precision, recall and patch correctness.',
  },
];

const faqs = [
  {
    q: 'How is RepoVeriX different from a code scanner?',
    a: 'Scanners emit findings; RepoVeriX grounds them. Each finding carries an evidence chain (source → transformation → sink), a counterexample check, and a confidence derived from evidence — then repairs are certified by actually running your tests in a sandbox.',
  },
  {
    q: 'Does it need an LLM API key to work?',
    a: 'No. Deterministic layers — static analysis, code health, git intelligence, attack paths, evidence validation — run without any LLM. LLM reasoning, wiki prose and LLM-generated tests activate when you configure a provider.',
  },
  {
    q: 'Which platforms can I import from?',
    a: 'GitHub and GitLab (connect with OAuth or paste a URL), any git host, a direct archive URL (including S3 presigned links), or a ZIP upload. Archives are scanned for traversal, symlink and zip-bomb attacks.',
  },
  {
    q: 'Can I run it myself?',
    a: 'Yes — RepoVeriX can be deployed with Docker Compose. The same codebase runs the hosted product.',
  },
  {
    q: 'Are patches ever applied to my code automatically?',
    a: 'Never. Patches are generated as reviewable diffs and only applied inside an isolated verification copy where tests and static checks run first.',
  },
  {
    q: 'What exactly counts as a scan?',
    a: 'One run of the analysis pipeline against a repository snapshot: Free includes 5 a month, Pro 60, Team 400. Re-scanning the same repository consumes another scan; completed results, findings and evidence stay stored per scan.',
  },
  {
    q: 'How do I know a finding is not a false positive?',
    a: 'The counterexample engine tries to disprove every claim: it traces the data flow to the sink, looks for sanitizers, authorization checks and framework protections, searches tests for confirmation, and only then assigns VERIFIED, PROBABLE or REJECTED with a confidence derived from that evidence. A candidate test can also be generated and executed to reproduce the defect.',
  },
  {
    q: 'Which languages are supported?',
    a: 'Static detectors and tree-sitter parsing cover Python, JavaScript and TypeScript (symbols, call graph, source→sink chains). Code health, git analytics, architecture and LLM reasoning work across the repository regardless of language.',
  },
  {
    q: 'What happens when I hit a plan limit?',
    a: 'The action is refused with an explicit upgrade prompt — nothing is silently degraded or deleted. Monthly counters reset at the start of each billing period, and your repositories and past scans remain available.',
  },
  {
    q: 'Is my code safe?',
    a: 'Repositories land in isolated per-repository storage and uploads are validated (traversal, symlink and zip-bomb checks) with hard size caps. Verification runs untrusted code only inside resource-limited Docker sandboxes with no host secrets. The LLM never receives the whole repository — bounded, redacted context — and treats code as untrusted data it must not obey. OAuth tokens are encrypted at rest when your deployment sets the key.',
  },
  {
    q: 'Can I cancel or downgrade?',
    a: 'Yes — cancel or change plans anytime from the billing portal. A paid plan stays active through its current period, then falls back to Free; scans, findings and evidence remain accessible within the Free limits.',
  },
];

/** Schema.org FAQPage markup generated from the same array that renders the
 *  visible FAQ — the structured data always mirrors on-page content. */
function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export default function HomePage() {
  // Nonce for the FAQ JSON-LD block (strict script-src CSP, see middleware.ts).
  const nonce = getNonce();
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="RepoVeriX home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) =>
              link.href.startsWith('#') ? (
                <a
                  key={link.name}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.name}
                </Link>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="border bg-card shadow-sm ring-1 ring-border hover:bg-card/80" />
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="shadow-sm">Start free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(55%_80%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Evidence-grounded · Verified repairs
            </span>
            <h1 className="mt-6 text-balance font-display text-5xl font-semibold tracking-tight sm:text-6xl">
              Repository intelligence
              <br />
              that <span className="italic text-primary">shows its work</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Audit code with deterministic analysis and LLM reasoning, ground every finding in an
              evidence chain, and certify repairs by running your tests in a sandbox — before
              anything is called fixed.
            </p>

            {/* URL input */}
            <HeroRepoForm />
            <p className="mt-3 text-xs text-muted-foreground">
              Paste any public repository URL — or{' '}
              <a href="#explore" className="font-medium text-primary hover:underline">
                explore a sample repository
              </a>{' '}
              to see the evidence before signing in.
            </p>

            {/* Source strip */}
            <div className="mx-auto mt-12 max-w-4xl rounded-2xl border bg-card/70 p-4 shadow-sm backdrop-blur">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Import from anywhere
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {sources.map((s, i) => (
                  <div
                    key={s.label}
                    className="group flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2 py-2.5 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-sm"
                    style={{ transitionDelay: `${i * 20}ms` }}
                  >
                    <s.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="truncate font-medium">{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {sources.map((s) => s.note).join('  ·  ')}
              </p>
            </div>

            {/* Honest capability stats */}
            <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['12', 'code-health detectors'],
                ['8', 'evidence kinds in a chain'],
                ['4', 'research configurations'],
                ['5', 'ways to import a repo'],
              ].map(([value, label], i) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-center backdrop-blur transition-colors hover:border-primary/30"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <p className="font-display text-2xl font-semibold tracking-tight text-primary">{value}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* One index, many outcomes */}
      <section id="product" className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">One codebase index</p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
              One index. Six practical outcomes.
            </h2>
            <p className="mt-3 text-muted-foreground">
              RepoVeriX connects source structure, git history, health signals, evidence and tests
              once — then the same index powers code health, change risk, attack paths, docs and
              verified repair.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap, i) => (
              <ScrollReveal key={cap.title} delay={i * 60} className="h-full">
              <div className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <cap.icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold">{cap.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
                <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-4 text-sm">
                  {cap.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence you can inspect */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <ScrollReveal>
            <p className="text-sm font-medium text-primary">Evidence you can inspect</p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
              A scanner tells you what&apos;s wrong. RepoVeriX shows you the proof — and proves the fix.
            </h2>
            <div className="mt-8 space-y-4">
              {[
                ['Evidence chains', 'Every finding links source input → transformation → sink with real code excerpts and line numbers.'],
                ['Confidence, not vibes', 'VERIFIED / PROBABLE / REJECTED is computed from evidence and validation, not model bravado.'],
                ['Counterexample checks', 'Proof-of-absence: if a sanitizer guards the sink, the claim is flagged — with the exact lines.'],
                ['Sandboxed repair verification', 'Patches run your tests and static checks in an isolated container before a fix is certified.'],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/auth/signup" className="group mt-8 inline-block">
              <Button size="lg" className="gap-2 px-7 shadow-md">
                Run a real scan free
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={120}>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              How a repair gets verified
            </p>
            <div className="mt-4 space-y-3 text-[13px]">
              <div className="space-y-2 rounded-lg border border-border/70 p-4">
                <p className="flex items-center gap-2 text-foreground/80">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  Patch applied to an isolated copy — never your branch
                </p>
                <p className="flex items-center gap-2 text-foreground/80">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  Dependencies installed inside a resource-limited sandbox
                </p>
                <p className="flex items-center gap-2 text-foreground/80">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  Your test suite runs against the patched copy
                </p>
                <p className="flex items-center gap-2 text-foreground/80">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  Static checks re-run (ruff / ESLint) — no new issues
                </p>
                <p className="flex items-center gap-2 text-foreground/80">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  The same detectors re-run — the finding must be gone
                </p>
                <p className="mt-2 font-sans text-sm font-semibold text-foreground">
                  Verdicts are deterministic:{' '}
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">VERIFIED REPAIR</span>
                  {' '}· REPAIR FAILED · NOT VERIFIED
                </p>
              </div>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Explore sample repositories */}
      <section id="explore" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">Evidence you can inspect</p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
                Sample repositories, real findings
              </h2>
              <p className="mt-3 text-muted-foreground">
                Start with the deliberately vulnerable fixtures from RepoVeriX&apos;s own test suite —
                real findings, evidence chains and verified repairs — or import your own repository
                and run the same pipeline on your code.
              </p>
            </div>
          </ScrollReveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                name: 'vulnerable_app',
                meta: 'Python · Flask-style · 5 files',
                body: 'A deliberately vulnerable Python app used as a test fixture: SQL injection, command injection, eval, hardcoded secrets and weak crypto — with the finding chain and a fixed_app for comparison.',
                tags: ['SQLi', 'RCE', 'Secrets'],
              },
              {
                name: 'your-repository',
                meta: 'Any git host · archive · ZIP upload',
                body: 'Import a public or private repository — GitHub, GitLab, any git host, an archive URL or a ZIP — and audit it with the full evidence pipeline.',
                tags: ['Evidence chains', 'Verified repairs'],
              },
              {
                name: 'vulnerable_js',
                meta: 'Node.js · Express · 2 files',
                body: 'A deliberately vulnerable Node/Express API fixture: unsanitized SQL, OS command injection, eval of user input and a fake Stripe secret.',
                tags: ['SQLi', 'RCE', 'Secrets'],
              },
            ].map((repo, i) => (
              <ScrollReveal key={repo.name} delay={i * 80}>
                <div className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-semibold">{repo.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{repo.meta}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{repo.body}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {repo.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <Link href="/auth/signup" className="mt-5">
                    <Button variant="outline" className="w-full gap-2">
                      Audit this repository <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* PR workflow */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">Change audit in your PR workflow</p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
                Merge checks backed by repository evidence
              </h2>
              <p className="mt-3 text-muted-foreground">
                Point the change-audit API at any diff and get deterministic directives — the same
                questions a careful reviewer asks, answered from the call graph and git history.
              </p>
            </div>
          </ScrollReveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: GitPullRequest,
                title: 'Changed contracts',
                body: 'See every caller outside the diff before an interface change merges — blast radius computed over the call graph.',
              },
              {
                icon: ShieldAlert,
                title: 'Missing co-changes',
                body: 'Catch files that git history says usually move with this change, plus changed files no test touches.',
              },
              {
                icon: Rocket,
                title: 'Merge checks',
                body: 'A 0–10 risk score from size, blast radius, file health and test coverage, with the exact tests to run.',
              },
            ].map((check, i) => (
              <ScrollReveal key={check.title} delay={i * 80}>
                <div className="flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <check.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold">{check.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{check.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Run it your way */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">Run it your way</p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
                One engine. Three ways to operate it.
              </h2>
            </div>
          </ScrollReveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Server,
                title: 'Self-hosted',
                body: 'Run RepoVeriX yourself with Docker Compose — code, storage and model provider stay under your control.',
                cta: 'Deploy your own',
                href: '/docs/getting-started',
                external: false,
              },
              {
                icon: Building2,
                title: 'Hosted',
                body: 'Sign in free, audit public and private repositories with full history, and add seats when your team needs them.',
                cta: 'Start free',
                href: '/auth/signup',
                external: false,
              },
              {
                icon: FlaskIcon,
                title: 'Research',
                body: 'Use the benchmark dataset and four-configuration harness to reproduce the precision, recall and patch-correctness results.',
                cta: 'See the research',
                href: '#research',
                external: false,
              },
            ].map((option, i) => (
              <ScrollReveal key={option.title} delay={i * 80}>
                <div className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <option.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold">{option.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{option.body}</p>
                  <Link
                    href={option.href}
                    target={option.external ? '_blank' : undefined}
                    rel={option.external ? 'noopener noreferrer' : undefined}
                    className="mt-5"
                  >
                    <Button variant="outline" className="w-full gap-2">
                      {option.cta} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Workflows */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">Fit your workflow</p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
              From index to everyday work
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {workflows.map((w, i) => (
              <ScrollReveal key={w.title} delay={i * 60} className="h-full">
              <div className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <w.icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
              </div>
              </ScrollReveal>
            ))}
          </div>

          {/* SARIF / CI strip */}
          <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-2xl border bg-card p-8 shadow-sm sm:flex-row">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
                <FileJson className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">Drops into the tools you already use</h3>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Export findings as SARIF 2.1.0 and feed GitHub Code Scanning or VS Code. Run
                  change audits from your CI and gate merges on deterministic risk evidence.
                </p>
              </div>
            </div>
            <Link href="/docs" className="shrink-0">
              <Button variant="outline" className="gap-2">
                <BookOpen className="h-4 w-4" /> Read the docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Research */}
      <section id="research" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-primary">Built for research</p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
              RepoVeriX-Bench: measure, don&apos;t claim.
            </h2>
            <p className="mt-4 text-muted-foreground">
              The research claim is not &quot;an LLM finds bugs&quot; — it is that LLM reasoning
              combined with deterministic evidence and automated verification measurably beats
              either alone. RepoVeriX ships the harness to prove it:
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'A benchmark dataset of repositories with known defects and ground truth',
                'Four experiment configurations: static-only, LLM-only, hybrid, full RepoVeriX',
                'Evaluation scripts for precision, recall, F1, false-positive rate and patch correctness',
                'No fabricated numbers — every published result comes from a real run',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Experiment matrix
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4 font-semibold">Configuration</th>
                    <th className="pb-2 pr-4 font-semibold">Static</th>
                    <th className="pb-2 pr-4 font-semibold">LLM</th>
                    <th className="pb-2 font-semibold">Evidence graph</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {[
                    ['Static only', '✓', '—', '—'],
                    ['LLM only', '—', '✓', '—'],
                    ['Static + LLM', '✓', '✓', '—'],
                    ['RepoVeriX', '✓', '✓', '✓'],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="py-2.5 pr-4 font-medium">{row[0]}</td>
                      {row.slice(1).map((cell, ci) => (
                        <td key={ci} className="py-2.5 pr-4">
                          {cell === '✓' ? (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Metrics: precision · recall · F1 · false-positive rate · patch correctness ·
              verification success · tokens &amp; cost.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-center text-sm font-medium text-primary">Plans & pricing</p>
          <h2 className="mt-2 text-center font-display text-4xl font-semibold tracking-tight text-balance">
            Pay for audits, not for seats you don&apos;t use
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Start free, no card required. Upgrade when the evidence is working for you.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                name: 'Free',
                price: 0,
                tagline: 'Try RepoVeriX on a small repository.',
                features: ['3 repositories', '5 scans / month', 'Static + hybrid findings', '2 AI fixes', '2 sandbox verifications'],
                cta: 'Start free',
                highlight: false,
              },
              {
                name: 'Pro',
                price: 29,
                tagline: 'For developers who audit code every week.',
                features: ['20 repositories', '60 scans / month', 'Full LLM reasoning', 'Unlimited findings & evidence', 'Sandboxed verified repairs', 'Change audit & SARIF export'],
                cta: 'Go Pro',
                highlight: true,
              },
              {
                name: 'Team',
                price: 99,
                tagline: 'For teams shipping and reviewing together.',
                features: ['100 repositories', '400 scans / month', '5 collaborators', 'Priority queue & support', 'Audit history & reports', 'Everything in Pro'],
                cta: 'Start with Team',
                highlight: false,
              },
            ].map((plan, i) => (
              <ScrollReveal key={plan.name} delay={i * 80} className="h-full">
              <div
                className={`group relative flex h-full flex-col rounded-2xl border p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${
                  plan.highlight ? 'border-primary/40 bg-card' : 'border-border/70 bg-card/60'
                }`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    Most popular
                  </span>
                )}
                <div className="flex items-baseline gap-1.5">
                  <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                  <span className="ml-auto text-3xl font-semibold tracking-tight">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">/ mo</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/auth/signup?plan=${plan.name.toLowerCase()}`} className="mt-7 block">
                  <Button
                    variant={plan.highlight ? 'default' : 'outline'}
                    className="w-full gap-2 shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Prices in USD. Cancel anytime. Questions?{' '}
            <Link href="/help/contact" className="font-medium text-primary hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-4xl font-semibold tracking-tight">
          Questions, answered
        </h2>
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border bg-card px-6 py-4 shadow-sm open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
        />
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-balance">
            Bring in a repository — even a vulnerable one — and watch the evidence build.
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup" className="group">
              <Button size="lg" className="gap-2 px-8 shadow-md">
                Create free account{' '}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/docs/getting-started">
              <Button size="lg" variant="outline" className="gap-2 px-8">
                <BookOpen className="h-4 w-4" /> Read the docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-4 text-sm text-muted-foreground">
                Evidence-grounded repository auditing and verified automated repair. Built as a
                research prototype with a real benchmark harness.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
              {[
                {
                  title: 'Product',
                  links: [
                    ['Features', '#product'],
                    ['Pricing', '#pricing'],
                    ['Research', '#research'],
                    ['Start free', '/auth/signup'],
                  ],
                },
                {
                  title: 'Resources',
                  links: [
                    ['Docs', '/docs'],
                    ['Help center', '/help'],
                    ['Getting started', '/docs/getting-started'],
                    ['API reference', '/docs/api'],
                    ['Blog', '/blog'],
                    ['Changelog', '/changelog'],
                    ['Vulnerability guides', '/vulnerabilities'],
                    ['Detection rules', '/detections'],
                    ['Glossary', '/glossary'],
                    ['Compare', '/compare'],
                    ['Sign in', '/auth/login'],
                  ],
                },
                {
                  title: 'Integrations',
                  links: [
                    ['GitHub', '/integrations/github'],
                    ['GitLab', '/integrations/gitlab'],
                    ['SARIF export', '/docs/features'],
                  ],
                },
                {
                  title: 'Company',
                  links: [
                    ['About', '/#product'],
                    ['Contact', '/help/contact'],
                    ['Community', '/help/community'],
                    ['Privacy', '/privacy'],
                    ['Terms', '/terms'],
                  ],
                },
              ].map((col) => (
                <div key={col.title}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.title}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <Link
                          href={href}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-2">
              <LogoMark className="h-4 w-4" />
              <span>© 2026 RepoVeriX</span>
            </div>
            <p>Deterministic evidence · LLM reasoning · Sandbox verification</p>
          </div>
        </div>
      </footer>
    </main>
  );
}