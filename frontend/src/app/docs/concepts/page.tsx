import type { Metadata } from 'next';
import { H1, H2, P, C, Ul, Li, Card, Callout, DocLink } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'Core concepts',
  description: 'Scans, evidence chains, finding statuses (VERIFIED / PROBABLE / REJECTED) and how RepoVeriX validates AI output.',
  alternates: { canonical: '/docs/concepts' },
};

export default function DocsConceptsPage() {
  return (
    <>
      <H1>Concepts &amp; evidence</H1>
      <P lead>
        RepoVeriX is built around one sentence:{' '}
        <span className="font-medium text-foreground">
          the LLM proposes, repository evidence supports, execution verifies.
        </span>{' '}
        Every design decision — statuses, confidence, fingerprints, verdicts — exists to enforce
        it.
      </P>

      <H2 id="pipeline">The scan pipeline</H2>
      <P>A scan runs six stages. Each records an <C>analysis_run</C> you can inspect:</P>
      <ol className="mt-4 space-y-3">
        {[
          ['1 · Ingestion', 'Repository is cloned or a ZIP/archive is extracted — with path-traversal, symlink, zip-bomb and oversized-file protections. Metadata (language, LOC, dependencies, git history) is recorded.'],
          ['2 · Parsing', 'Tree-sitter AST parsing for Python, JavaScript and TypeScript. Symbols (functions, classes, methods), imports, calls, and test files are extracted into a repository model.'],
          ['3 · Static analysis', 'Ruff + Bandit + built-in deterministic detectors. Every observation is normalized into a finding candidate: rule, severity, file, line, message, tool.'],
          ['4 · Knowledge graph', 'Symbols are linked — who calls whom, what imports what, which files map to tests, which endpoints touch the database. This is what makes analysis repository-level rather than file-level.'],
          ['5 · LLM reasoning', 'Optional. When a provider is configured, the LLM reviews evidence-enriched candidates and produces additional candidates with explicit claims. Unconfigured scans degrade gracefully — deterministic layers still run.'],
          ['6 · Evidence validation', 'Every candidate is checked against repository evidence: the claim, its source and sink, sanitization or authorization guards, framework protections. Candidates that survive become findings with a status.'],
        ].map(([title, body]) => (
          <li key={title} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>

      <H2 id="evidence">The evidence model</H2>
      <P>
        A finding is not a verdict from a model — it is a structured claim plus its evidence:
      </P>
      <Ul>
        <Li>
          <span className="font-medium text-foreground">Claim</span> — the rule/category (e.g.,
          &quot;SQL injection&quot;) and what the code does wrong.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Source</span> — where untrusted or
          problematic input enters (HTTP parameter, uploaded filename, CLI argument…).
        </Li>
        <Li>
          <span className="font-medium text-foreground">Transformation</span> — what happens to the
          data on the way (string interpolation, path join, deserialization…).
        </Li>
        <Li>
          <span className="font-medium text-foreground">Sink</span> — the sensitive operation
          reached (SQL execution, shell execution, filesystem write, HTML render…).
        </Li>
        <Li>
          <span className="font-medium text-foreground">Supporting and contradicting evidence</span>{' '}
          — the validation battery collects both, with file:line references.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Confidence</span> — computed from evidence
          strength and validation, never assigned arbitrarily by the LLM.
        </Li>
      </Ul>

      <H2 id="statuses">Finding statuses</H2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card title="VERIFIED">
          Sufficient evidence supports the claim and no counterexample was found — for example, a
          data-flow path from user input to an unguarded SQL sink is demonstrated with line
          numbers.
        </Card>
        <Card title="PROBABLE">
          Evidence is concerning but incomplete — for example, an attack path leaves the parsed
          call graph, or a sink is reached through code the graph cannot resolve. Never claimed as
          an exploit.
        </Card>
        <Card title="REJECTED">
          A counterexample refutes the claim — a sanitizer, parameterized query, authorization
          check or framework protection sits between the source and the sink. The refuting
          evidence is recorded.
        </Card>
      </div>
      <Callout kind="info">
        REJECTED is not a failure — it is the system doing its job. Counting candidates that were
        refuted is how RepoVeriX measures false-positive reduction, which is logged for the
        research experiments.
      </Callout>

      <H2 id="identity">Finding identity &amp; deduplication</H2>
      <P>
        Findings are never identified by database ID alone. Each finding has a{' '}
        <span className="font-medium text-foreground">fingerprint</span> derived from its rule,
        repository-relative file, symbol and normalized location — so the same defect reported by
        three tools collapses into one cluster, and the same bug keeps its identity even when the
        code moves lines.
      </P>
      <Ul>
        <Li>
          <span className="font-medium text-foreground">Dedup clusters</span> merge duplicate
          observations of one defect into a logical finding with multiple evidence sources.
        </Li>
        <Li>
          <span className="font-medium text-foreground">Regression detection</span> compares scans
          by fingerprint: RESOLVED, STILL_PRESENT, NEW, REGRESSED, or SEVERITY_CHANGED — so a bug
          that returns through a new data flow is reported as a regression with both pieces of
          evidence.
        </Li>
      </Ul>

      <H2 id="verdicts">Repair verdicts</H2>
      <P>
        When a patch is verified, the decision comes from recorded execution, not from the LLM.
        The Proof of Fix record aggregates:
      </P>
      <Ul>
        <Li>Original defect reproduction no longer succeeds (the reproduction test fails before the patch and passes after it).</Li>
        <Li>Relevant tests pass in the sandbox.</Li>
        <Li>Relevant static-analysis finding disappears after the patch.</Li>
        <Li>No new critical finding is introduced by the patch.</Li>
      </Ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card title="VERIFIED FIX">All required validation checks passed in the sandbox — reproduction gone, tests green, finding no longer detected, no new critical issue.</Card>
        <Card title="REJECTED FIX / PARTIALLY_VERIFIED / UNVERIFIABLE">Tests failed, the issue remains, or the environment prevented meaningful validation. Missing evidence is reported as absent — never invented as a pass.</Card>
      </div>

      <H2 id="honesty">Honesty rules</H2>
      <Ul>
        <Li>Never claim exploitability without evidence — incomplete paths are PROBABLE.</Li>
        <Li>
          Never claim a dependency is <C>NOT_REACHABLE</C> merely because a search found nothing.
          Distinguish &quot;not found&quot; from &quot;proven unreachable&quot; — the latter
          requires positive evidence such as an in-repo module shadowing the package.
        </Li>
        <Li>
          Never mark a fix VERIFIED because an LLM says it is correct — only execution and evidence
          can.
        </Li>
        <Li>
          Repository content is untrusted data. It can never override system analysis
          instructions, and secrets are never included in prompts, logs, or reports.
        </Li>
        <Li>
          The natural-language assistant only answers from the repository index. If evidence is
          insufficient it says so instead of inventing files or functions.
        </Li>
      </Ul>

      <H2 id="research">Why this matters</H2>
      <P>
        Because verdicts, confidence and rejection reasons are evidence-derived and logged, the
        research harness can honestly compare configurations (static-only, LLM-only, hybrid, full
        RepoVeriX) on precision, recall, F1, false-positive rate, patch correctness and token cost
        — see <DocLink href="/docs/research">RepoVeriX-Bench</DocLink>.
      </P>
    </>
  );
}
