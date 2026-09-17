import type { Metadata } from 'next';
import { H1, H2, H3, P, C, Ol, Li, Ul, Card, Callout, DocLink, Code } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'Getting started',
  description: 'Import your first repository into RepoVeriX and run a full evidence-grounded audit in minutes.',
  alternates: { canonical: '/docs/getting-started' },
};

export default function DocsQuickStartPage() {
  return (
    <>
      <H1>Quick start</H1>
      <P lead>
        Two ways to use RepoVeriX: sign in to the hosted product and import a repository, or run it
        yourself. Both share the same core workflow — import, scan, inspect evidence, verify a fix.
      </P>

      <H2 id="hosted">1 · Start with the hosted product</H2>
      <Ol>
        <Li>
          <DocLink href="/auth/signup">Create a free account</DocLink> — email, or sign in with
          GitHub, Google, or GitLab.
        </Li>
        <Li>
          Open <span className="font-medium text-foreground">Repositories → Import repository</span>
          . Pick a source: <C>GitHub</C> or <C>GitLab</C> (OAuth connect or a plain public URL),{' '}
          <C>Any git host</C>, <C>Archive URL</C> (including S3 presigned links), or{' '}
          <C>ZIP upload</C>.
        </Li>
        <Li>
          Once imported, open the repository and press{' '}
          <span className="font-medium text-foreground">Scan</span>. Choose a configuration —
          <C>static_only</C>, <C>llm_only</C>, <C>static_llm</C>, or the full <C>repoverix</C>{' '}
          pipeline.
        </Li>
        <Li>
          When the scan finishes, open its findings. Every finding shows severity, evidence chain
          (source → sink), validation status and confidence.
        </Li>
      </Ol>
      <Callout kind="tip">
        The deterministic layers — static analysis, code health, attack paths, evidence validation —
        run without any LLM key. LLM reasoning, wiki prose and LLM-generated tests activate only
        when a provider is configured.
      </Callout>

      <H2 id="self-host">2 · Run it yourself</H2>
      <H3>Prerequisites</H3>
      <Ul>
        <Li>Python 3.12+ and Node.js 18+</Li>
        <Li>Docker (recommended) — used to sandbox patch verification and generated tests</Li>
        <Li>PostgreSQL (optional) — SQLite is used for local development by default</Li>
      </Ul>

      <H3>Backend</H3>
      <Code title="backend/">{`python -m venv .venv
.venv/Scripts/activate            # Windows; POSIX: source .venv/bin/activate
pip install -e ".[dev]"

REPOVERIX_DATABASE_URL=sqlite+aiosqlite:///./data/dev.db \\
  .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000`}</Code>
      <P>
        Health check: <C>http://127.0.0.1:8000/health</C>. Interactive API docs at{' '}
        <C>http://127.0.0.1:8000/docs</C>. With SQLite, tables are created automatically
        (<C>REPOVERIX_AUTO_CREATE_TABLES=true</C>); with PostgreSQL, run{' '}
        <C>alembic upgrade head</C>.
      </P>

      <H3>Frontend</H3>
      <Code title="frontend/">{`npm install
npm run dev                      # http://localhost:3000`}</Code>
      <P>
        The frontend calls <C>http://127.0.0.1:8000</C> — point <C>NEXT_PUBLIC_API_URL</C> at your
        backend if it is elsewhere. Log in with the account you create in the UI.
      </P>

      <H3>Production / Docker Compose</H3>
      <Code title="project root">{`docker compose up --build          # full stack: frontend + backend + postgres`}</Code>
      <P>
        See <DocLink href="/docs/configuration">Configuration &amp; keys</DocLink> for the complete
        environment reference, including the production checklist (LLM key, OAuth clients, Stripe,
        JWT secret, PostgreSQL URL).
      </P>

      <H2 id="core-loop">3 · The core loop</H2>
      <Ol>
        <Li>
          <span className="font-medium text-foreground">Scan.</span> The pipeline ingests, parses
          (tree-sitter AST), runs static analysis, builds the knowledge graph, optionally applies
          LLM reasoning, then validates evidence and persists findings. Each stage is recorded as an{' '}
          <C>analysis_run</C> on the scan page.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Inspect.</span> From a finding, open the{' '}
          <span className="font-medium text-foreground">Evidence</span> tab (source → sink chain
          with line numbers), the <span className="font-medium text-foreground">Validate</span> tab
          (counterexample battery), and <span className="font-medium text-foreground">Ask</span>{' '}
          for a grounded explanation.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Repair.</span> Request a candidate patch{' '}
          (<C>Generate fix</C>). It is only ever a reviewable diff.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Verify.</span> Send the patch through{' '}
          <span className="font-medium text-foreground">Verify fix</span> — it is applied to an
          isolated copy where tests, static checks and re-analysis run. Open{' '}
          <span className="font-medium text-foreground">Proof of fix</span> for the full checklist
          and decision.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Compare.</span> Rescan later and open the
          regression page to see what was resolved, what is new, and what returned.
        </Li>
      </Ol>
      <Callout kind="warn">
        Patches are never applied to your repository automatically. Verification runs inside an
        isolated copy; you decide whether to apply the diff to your own code.
      </Callout>

      <H2 id="next">Where next</H2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card title="Understand the model">
          How statuses, confidence, fingerprints and verdicts are computed —{' '}
          <DocLink href="/docs/concepts">Concepts &amp; evidence</DocLink>.
        </Card>
        <Card title="Explore every feature">
          Impact, PR audit, attack paths, dedup, health timeline, SARIF and more —{' '}
          <DocLink href="/docs/features">Feature guide</DocLink>.
        </Card>
      </div>
    </>
  );
}
