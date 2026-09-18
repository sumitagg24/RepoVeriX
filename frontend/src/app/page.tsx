import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Cpu,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Github,
  Gitlab,
  Layers,
  Lock,
  Play,
  Radar,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { PlanTable } from '@/components/marketing/plan-table';
import { HeroProductPreview } from '@/components/marketing/hero-product-preview';
import { FaqAccordion } from '@/components/marketing/faq-accordion';
import { getNonce } from '@/lib/csp-server';

export const metadata: Metadata = {
  title: 'RepoVeriX - Next-Generation Repository Security & Intelligence',
  description:
    'Find code risks. Understand impact. Verify the fix. Automated code security intelligence that traces real execution paths and certifies repairs in sandboxes.',
};

const PLATFORMS = [
  { icon: Github, label: 'GitHub App', href: '/integrations/github' },
  { icon: Gitlab, label: 'GitLab CI', href: '/integrations/gitlab' },
  { icon: GitBranch, label: 'Any Git Host' },
  { icon: Terminal, label: 'CLI & CI/CD' },
];

const OUTCOMES = [
  {
    icon: Radar,
    title: 'See What Matters',
    description:
      'Ditch thousands of noisy AST warnings. RepoVeriX evaluates reachable execution paths to isolate high-consequence vulnerabilities.',
    badge: 'Precision Filtering',
  },
  {
    icon: GitPullRequest,
    title: 'Understand the Path',
    description:
      'Trace tainted data step-by-step from untrusted inputs through business logic transformations straight to the dangerous sink.',
    badge: 'Call Graph Intelligence',
  },
  {
    icon: Sparkles,
    title: 'Fix With Confidence',
    description:
      'Receive context-aware, surgically crafted patches that resolve the flaw while adhering to your codebase style and contracts.',
    badge: 'Automated Remediation',
  },
  {
    icon: ShieldCheck,
    title: 'Verify Before Shipping',
    description:
      'Candidate fixes are compiled and run against your existing test suite in an isolated sandbox to prove zero regressions.',
    badge: 'Sandbox Proof',
  },
];

const CAPABILITIES = [
  {
    icon: ScanSearch,
    title: 'Deep Static + Semantic Analysis',
    tag: 'Analysis Engine',
    description:
      'Deterministic AST rules combined with semantic LLM reasoning detect SQL injections, SSRF, broken access control, and secret leakage.',
    detail: 'Indexes the entire dependency tree and call hierarchy to eliminate isolated false positives.',
  },
  {
    icon: Layers,
    title: 'Visual Taint & Attack Paths',
    tag: 'Path Discovery',
    description:
      'Interactive evidence chains trace untrusted parameters through intermediate handlers directly to dangerous database or OS calls.',
    detail: 'Reviewers can inspect line-by-line evidence without guessing why a finding was flagged.',
  },
  {
    icon: ShieldAlert,
    title: 'Automated Sandbox Verification',
    tag: 'Zero Regressions',
    description:
      'Every repair is validated by re-running your pytest or jest suites inside an isolated container to ensure functionality stays intact.',
    detail: 'If a patch breaks existing unit tests or fails to eradicate the sink, it is rejected immediately.',
  },
  {
    icon: Boxes,
    title: 'Architecture & Change Risk',
    tag: 'Continuous Health',
    description:
      'Track security posture deltas across pull requests and git branches. Spot architectural risk hotspots before they ship to production.',
    detail: 'Automated PR bot annotates diffs with actionable fix proposals and verified sandbox proofs.',
  },
];

const FAQS = [
  {
    q: 'How does RepoVeriX differ from traditional SAST tools?',
    a: 'Traditional scanners emit thousands of unranked pattern matches that flood triage queues. RepoVeriX requires evidence: it models the call graph from input source to dangerous sink, crafts a candidate fix, and verifies the fix by running your tests in an isolated sandbox.',
  },
  {
    q: 'How does sandboxed verification work?',
    a: 'When an analysis identifies a verified flaw, RepoVeriX spins up a ephemeral sandbox container configured with your project dependencies. It executes your existing test suite against the proposed fix and confirms both that the vulnerable sink is gone and that all tests pass.',
  },
  {
    q: 'Which languages and platforms are supported?',
    a: 'RepoVeriX integrates natively with GitHub, GitLab, and any standard Git repository. Detection rules and verification runners are currently optimized for Python, JavaScript, and TypeScript, with Go and Java support in active preview.',
  },
  {
    q: 'Do you store our proprietary source code?',
    a: 'No. Repositories are analyzed ephemerally in memory or within isolated sandbox workers during active analysis runs. RepoVeriX never trains foundation models on customer code.',
  },
  {
    q: 'Can RepoVeriX run in our CI/CD pipeline?',
    a: 'Yes. You can use our GitHub Action, GitLab CI pipeline template, or run scans via our developer CLI. Findings and verified fixes are posted directly as pull request review comments.',
  },
];

export default function HomePage() {
  const nonce = getNonce();

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };

  return (
    <MarketingShell>
      <main className="relative overflow-hidden">
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -z-10 h-[550px] w-full max-w-7xl -translate-x-1/2 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent blur-3xl" />

        {/* ---------------------------------------------------- Hero Section */}
        <section className="relative px-4 pt-16 pb-20 sm:px-6 lg:px-8 lg:pt-24 lg:pb-28">
          <div className="mx-auto max-w-5xl text-center">
            {/* Kicker Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>RepoVeriX 2.0 · Automated Code Risk Intelligence</span>
              <ArrowRight className="h-3 w-3" />
            </div>

            {/* Main Headline */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Next-Generation <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Repository Intelligence
              </span>
            </h1>

            {/* Core Message */}
            <p className="mt-4 text-xl font-medium tracking-tight text-foreground/90 sm:text-2xl">
              Find code risks. Understand impact. Verify the fix.
            </p>

            {/* Sub-paragraph */}
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              RepoVeriX traces real execution paths from source to sink, keeps the evidence visible,
              and certifies automated patches by executing your tests in an isolated sandbox.
            </p>

            {/* Primary & Secondary Action CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="h-12 px-6 text-base font-semibold shadow-md gap-2">
                <Link href="/auth/signup">
                  Start free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base font-medium shadow-sm">
                <a href="#demo">Explore live demo</a>
              </Button>
            </div>

            {/* Platform Compatibility Indicators */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Connects natively to:</span>
              {PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                return platform.href ? (
                  <Link
                    key={platform.label}
                    href={platform.href}
                    className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span>{platform.label}</span>
                  </Link>
                ) : (
                  <span key={platform.label} className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{platform.label}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Interactive Product Preview Frame */}
          <div id="demo" className="mt-14 sm:mt-16 scroll-mt-20">
            <HeroProductPreview />
          </div>
        </section>

        {/* ---------------------------------------------------- Bento Grid Outcomes */}
        <section className="border-t border-border/60 bg-muted/20 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Built for High-Velocity Teams
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                The four pillars of evidence-grounded security
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Stop chasing false positives. Know exactly what changed, why it matters, and how to verify the solution.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {OUTCOMES.map((outcome) => {
                const Icon = outcome.icon;
                return (
                  <div
                    key={outcome.title}
                    className="relative flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-primary/40"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {outcome.badge}
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">{outcome.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {outcome.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Capability Showcase */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Comprehensive Code Intelligence
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                A complete security operations suite for modern engineering
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                From initial commit indexing to continuous PR review and sandbox verification, RepoVeriX provides end-to-end assurance.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-2">
              {CAPABILITIES.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="rounded-2xl border border-border/70 bg-card p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                          {cap.tag}
                        </span>
                        <h3 className="text-lg font-bold text-foreground sm:text-xl">{cap.title}</h3>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {cap.description}
                    </p>
                    <div className="mt-5 rounded-lg border border-border/50 bg-muted/40 px-4 py-3 text-xs leading-relaxed text-foreground/80 font-medium">
                      💡 {cap.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Pricing Section */}
        <section id="pricing" className="border-t border-border/60 bg-muted/20 py-20 lg:py-28 scroll-mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Transparent Pricing
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Predictable plans that match your team
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                All plans include real repository indexing, taint path tracing, and automated repair guidance. Upgrade as your codebase expands.
              </p>
            </div>

            <div className="mt-14">
              <PlanTable />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- FAQ Section */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Frequently Asked Questions
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything you need to know
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Have more questions? Check our documentation or get in touch with our security engineering team.
              </p>
            </div>

            <div className="mt-12">
              <FaqAccordion faqs={FAQS} />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Bottom CTA */}
        <section className="relative border-t border-border/60 bg-muted/30 py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Ready to verify security fixes with confidence?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Import your first repository in 30 seconds. Start on our generous free tier with zero commitments and experience automated proof-backed remediation.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="h-12 px-8 text-base font-semibold shadow-lg gap-2">
                <Link href="/auth/signup">
                  Start free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base font-medium">
                <Link href="/docs/getting-started">View Documentation</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
