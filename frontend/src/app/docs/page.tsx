import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { H1, P, H2, Ul, Li, Card, Callout, DocLink, Code } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'RepoVeriX documentation: getting started, how analysis works, the evidence model, API reference, configuration and research methodology.',
  alternates: { canonical: '/docs' },
};

export default function DocsHomePage() {
  return (
    <>
      <H1>RepoVeriX documentation</H1>
      <P lead>
        RepoVeriX audits a repository and grounds every claim in repository evidence — then
        certifies repairs by actually running them. The core principle is{' '}
        <span className="font-medium text-foreground">
          the LLM proposes, repository evidence supports, execution verifies.
        </span>
      </P>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ['New here?', 'Quick start', '/docs/getting-started'],
          ['How the pipeline works', 'Concepts & evidence', '/docs/concepts'],
          ['Every feature, where to find it', 'Feature guide', '/docs/features'],
        ].map(([kicker, title, href]) => (
          <Link key={href} href={href} className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{kicker}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {title}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </div>

      <H2 id="what">What RepoVeriX does</H2>
      <P>
        Give RepoVeriX a repository — via GitHub or GitLab OAuth, any git URL, an archive URL
        (including S3 presigned links), or a ZIP upload — and it builds a reusable index from the
        source: AST symbols, imports, call relationships, git history, dependencies, tests, and
        code-health signals. That index then powers every analysis:
      </P>
      <Ul>
        <Li>
          <span className="font-medium text-foreground">Finding with evidence.</span> Security and
          logic findings carry an evidence chain — source input → transformation → sink — with real
          code excerpts and line numbers, then a counterexample check either supports the claim
          (VERIFIED), flags it as unproven (PROBABLE), or refutes it (REJECTED).
        </Li>
        <Li>
          <span className="font-medium text-foreground">Change intelligence.</span> Ask what breaks
          if a file or branch changes: blast radius over the call graph, affected APIs and tests,
          co-change companions from git history, and a deterministic risk score.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Verified repair.</span> Candidate patches
          are never trusted on the LLM&apos;s say-so. A reproduction test runs against the vulnerable
          and the patched copy; tests, static analysis, and re-analysis decide{' '}
          <span className="font-medium text-foreground">VERIFIED FIX</span> or not.
        </Li>
      </Ul>

      <H2 id="quick-paths">Where to go</H2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card title="I want to try it">
          Import a repository from the dashboard, start a scan, and open a finding — the{' '}
          <DocLink href="/docs/getting-started">quick start</DocLink> walks through each screen.
        </Card>
        <Card title="I want to configure it">
          LLM providers, OAuth keys, Stripe, database and sandbox settings are all environment
          variables — see <DocLink href="/docs/configuration">Configuration &amp; keys</DocLink>.
        </Card>
        <Card title="I want the details">
          Every engine and where it lives in the UI —{' '}
          <DocLink href="/docs/features">feature guide</DocLink> — plus the{' '}
          <DocLink href="/docs/api">API reference</DocLink>.
        </Card>
        <Card title="I want to judge it">
          The benchmark dataset, four experiment configurations and the metrics that matter —{' '}
          <DocLink href="/docs/research">RepoVeriX-Bench</DocLink>.
        </Card>
      </div>

      <H2 id="statuses">Finding statuses at a glance</H2>
      <Ul>
        <Li>
          <span className="font-medium text-foreground">VERIFIED</span> — the claim is supported by
          evidence and validation (e.g., untrusted input demonstrably reaches a sink without a
          guard).
        </Li>
        <Li>
          <span className="font-medium text-foreground">PROBABLE</span> — evidence is concerning but
          incomplete (e.g., the path leaves the parsed call graph).
        </Li>
        <Li>
          <span className="font-medium text-foreground">REJECTED</span> — a counterexample refutes
          the claim (e.g., a sanitizer or parameterized query protects the sink).
        </Li>
      </Ul>
      <Callout kind="warn">
        RepoVeriX never claims exploitability without evidence. When the complete path cannot be
        established, the finding is labelled PROBABLE — confidence is computed from evidence, not
        model bravado.
      </Callout>

      <H2 id="run-yourself">Run it yourself</H2>
      <P>
        RepoVeriX is self-hostable. The backend is FastAPI with SQLite (development) or PostgreSQL
        (production); the frontend is Next.js. Reproduce the repo in the browser at{' '}
        <DocLink href="/docs/getting-started">Quick start</DocLink> for the exact commands.
      </P>
      <Code title="Run locally">{`# backend (from backend/)
REPOVERIX_DATABASE_URL=sqlite+aiosqlite:///./data/dev.db \\
  .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# frontend (from frontend/)
npm run dev   # http://localhost:3000`}</Code>
    </>
  );
}
