import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
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
} from 'lucide-react';

const steps = [
  {
    icon: GitBranch,
    title: 'Import',
    body: 'Pull code from GitHub, GitLab, an S3 archive link, or a zip — public or private.',
  },
  {
    icon: ScanSearch,
    title: 'Analyze',
    body: 'Static analysis, symbol graphs and LLM reasoning converge on candidate findings.',
  },
  {
    icon: FlaskConical,
    title: 'Validate',
    body: 'An evidence engine marks each finding verified, probable or rejected.',
  },
  {
    icon: Hammer,
    title: 'Repair & verify',
    body: 'Generate a patch, then run it through tests in an isolated container. Only passing fixes are certified.',
  },
];

const sources = [
  { icon: Github, label: 'GitHub', note: 'connect or URL' },
  { icon: Gitlab, label: 'GitLab', note: 'connect or URL' },
  { icon: Cloud, label: 'AWS S3', note: 'object or presigned link' },
  { icon: UploadCloud, label: 'ZIP upload', note: 'from your computer' },
  { icon: GitBranch, label: 'Any git host', note: 'Bitbucket, Azure, self-hosted' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">RepoVeriX</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="shadow-sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(55%_80%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Evidence-grounded auditing · verified automated repair
            </span>
            <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
              AI proposes the fix.
              <br />
              <span className="italic text-primary">Proof decides.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              RepoVeriX audits repositories with deterministic analysis and LLM reasoning, grounds
              every finding in evidence, and certifies repairs by running your tests in a sandbox —
              before anything is called fixed.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/signup" className="group">
                <Button size="lg" className="gap-2 px-7 shadow-md">
                  Start auditing free
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="https://github.com/sumitagg24/RepoVeriX" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="px-7">
                  View on GitHub
                </Button>
              </Link>
            </div>
          </div>

          {/* Source strip */}
          <div className="mx-auto mt-16 max-w-4xl rounded-2xl border bg-card/70 p-4 shadow-sm backdrop-blur">
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
            <p className="mt-3 text-center text-xs text-muted-foreground">{sources.map((s) => s.note).join('  ·  ')}</p>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center font-display text-4xl font-semibold tracking-tight text-balance">
            From repository to certified repair
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            One continuous pipeline — no hand-waving, every claim backed by evidence or an
            execution log.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="group relative rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
              >
                <span className="absolute right-5 top-4 font-display text-3xl text-border transition-colors duration-300 group-hover:text-primary/25">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-primary">The RepoVeriX difference</p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
              A scanner tells you what&apos;s wrong. RepoVeriX shows you the proof — and proves the fix.
            </h2>
            <div className="mt-8 space-y-4">
              {[
                ['Evidence chains', 'Every finding links source input → transformation → sink with real code excerpts.'],
                ['Confidence, not vibes', 'VERIFIED / PROBABLE / REJECTED is computed from evidence and validation, not model bravado.'],
                ['Sandboxed repair verification', 'Patches run your tests and static checks in an isolated container before a fix is certified.'],
                ['Four research configurations', 'Compare static-only, LLM-only, hybrid and full RepoVeriX pipelines.'],
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
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live verdict</p>
            <div className="mt-4 space-y-3 font-mono text-[13px]">
              <div className="rounded-lg bg-muted/60 p-3 text-foreground/80">
                <span className="text-muted-foreground">$ </span>repoverix verify \
                <br />
                &nbsp;&nbsp;--finding RVX-SQLI-001 --patch sha-parameterize.diff
              </div>
              <div className="space-y-1.5 rounded-lg border border-border/70 p-4">
                <p className="flex items-center gap-2 text-green-700">
                  <Check className="h-3.5 w-3.5" /> patch applied to app.py
                </p>
                <p className="flex items-center gap-2 text-green-700">
                  <Check className="h-3.5 w-3.5" /> 4 tests passed · 0.4s
                </p>
                <p className="flex items-center gap-2 text-green-700">
                  <Check className="h-3.5 w-3.5" /> ruff clean — no new issues
                </p>
                <p className="flex items-center gap-2 text-green-700">
                  <Check className="h-3.5 w-3.5" /> RVX-SQLI-001 no longer detected
                </p>
                <p className="mt-2 font-sans text-sm font-semibold text-foreground">
                  Result: <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">VERIFIED REPAIR</span>
                </p>
              </div>
            </div>
          </div>
        </div>
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
            <Link href="https://github.com/sumitagg24/RepoVeriX" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2 px-8">
                <Github className="h-4 w-4" /> Star on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">RepoVeriX</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Evidence-grounded repository auditing</span>
          </div>
          <p>B.Tech Minor Project · Research prototype</p>
        </div>
      </footer>
    </main>
  );
}
