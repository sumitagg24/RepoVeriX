import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { H1, H2, H3, P, Ul, Li, Callout } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Code health, change risk, attack paths, dependency reachability, auto-wiki and verified automated repair — explained.',
  alternates: { canonical: '/docs/features' },
};

function Feature({ title, what, where, evidence }: { title: string; what: ReactNode; where: string; evidence: ReactNode }) {
  return (
    <section className="mt-8">
      <H3>{title}</H3>
      <P>{what}</P>
      <Ul>
        <Li>
          <span className="font-medium text-foreground">Where:</span> {where}
        </Li>
        <Li>
          <span className="font-medium text-foreground">Evidence it uses:</span> {evidence}
        </Li>
      </Ul>
    </section>
  );
}

export default function DocsFeaturesPage() {
  return (
    <>
      <H1>Feature guide</H1>
      <P lead>
        Every engine in RepoVeriX, where it appears in the product, and what repository evidence it
        is grounded in. Nothing below runs on model opinion alone — each feature reads the parse,
        the graph, git history, or recorded execution.
      </P>

      <H2 id="health">Code health &amp; architecture</H2>
      <Feature
        title="File-level code health"
        what="Every parseable file gets a deterministic 1–10 score across maintainability, complexity, duplication, and defect-risk signals, rolled into a repository health score with ranked hotspots."
        where="Repository → Code health tab; repository dashboard; the Ask assistant answers &quot;what are the highest-risk areas?&quot; from the same index."
        evidence="AST-derived metrics: cyclomatic complexity, nesting depth, module size, duplicate-code clones (normalized signatures), TODO density, comment ratio, test coverage adjacency."
      />
      <Feature
        title="Architecture smells"
        what="Repository-level structural problems: circular dependencies, excessive coupling (fan-in/fan-out), oversized modules and functions, and cross-layer boundary violations. Every smell reports the metric, its configured threshold, the measured value, and affected symbols and files."
        where="Audit and Research views expose the smell list; multi-agent research feeds them to the architecture analyst."
        evidence="A real import/module graph built from parsed files — never LLM opinion. Cycles come from strongly-connected-component detection on that graph."
      />
      <Feature
        title="Health timeline"
        what="Repository health tracked over time across real snapshots — each snapshot records overall and component risk plus verified/probable/rejected counts. Snapshots are recorded per index/scan event keyed by commit, so history grows only from actual recorded data."
        where="Repository → Health History."
        evidence="Stored health snapshots; nothing is back-filled or manufactured."
      />
      <Feature
        title="Code intelligence & auto-wiki"
        what="Per-file symbol and import inventories plus a layered architecture diagram generated from structure, with an optional LLM prose upgrade per module."
        where="Repository → Intelligence (Wiki + Architecture tabs)."
        evidence="Parsed symbols, imports, call edges and module groupings."
      />

      <H2 id="change">Change intelligence</H2>
      <Feature
        title="Change impact & risk analysis"
        what="Answers &quot;if this code changes, what else could break?&quot; for a pasted diff, a commit, or a base→head branch comparison. Output: 0–100 risk score with a factor breakdown, affected symbols and callers, blast radius, affected APIs and tests, co-change companions, and security/database impact."
        where="Repository → Audit → Change Audit tab (base/head refs or changed-file analysis)."
        evidence="Unified-diff parsing, the knowledge graph (callers/callees), test mapping, git co-change history, and security/database symbol classification. The risk score is deterministic."
      />
      <Feature
        title="Commit intelligence & explain-change"
        what="For a commit or ref, what changed functionally, what components are affected, security impact, affected tests, risks introduced, and findings resolved — with an evidence-referenced narrative."
        where="Repository → Audit (change audit detail and Explain change)."
        evidence="Git diff, changed symbols, dependency impact, static analysis and recorded findings."
      />
      <Feature
        title="Pull request auditing"
        what="Analyze a GitHub pull request end-to-end: fetch base/head commits, diff the change, run impact + static analysis, build inline comments tied to added lines, and produce a structured review (risk, verified/probable/rejected findings, regressions, suggested fixes). Review is previewed first — posting is an explicit, separate action."
        where="Pull Requests page → analyze a PR, then Preview Review → Post Review."
        evidence="Real GitHub metadata via OAuth-scoped access, worktree checkout of both commits, diff hunks, and the full repository index for context beyond the changed lines."
      />
      <Feature
        title="Regression detection"
        what="Compares scans of the same repository using stable fingerprints and reports RESOLVED / STILL_PRESENT / NEW / REGRESSED / SEVERITY_CHANGED, including bugs that return through a new data flow."
        where="Repository → Regression (scan-vs-scan comparison)."
        evidence="Fingerprint identity (rule + file + symbol + normalized location) and moved-code signature pairing — not database IDs."
      />

      <H2 id="security">Security analysis</H2>
      <Feature
        title="Attack paths"
        what="Multi-step paths from an entry point (HTTP endpoint, CLI, env, library) through user-controlled input and transformations to a sensitive sink (SQL, shell, eval, filesystem write, auth decision…), with a per-path risk score and per-hop file:line evidence. Paths fully resolved by the call graph are VERIFIED; flows that leave it are PROBABLE."
        where="Repository → Audit → Attack Paths tab."
        evidence="Parsed functions and call edges, entry-point and sink classification with weights."
      />
      <Feature
        title="Dependency reachability"
        what="For a vulnerable dependency, determines whether the vulnerable functionality is actually used: DIRECTLY_REACHABLE (import sites listed), INDIRECTLY_REACHABLE (transitive evidence), NOT_REACHABLE (only on positive shadowing evidence), or UNKNOWN — absence of an import is never claimed as unreachable."
        where="Repository → Audit → Dependencies tab (rows carry CVSS/vulnerability details, evidence and recommendations)."
        evidence="Lockfile package trees, in-repo import roots, and module-shadowing analysis."
      />
      <Feature
        title="Counterexample validation"
        what="For a candidate finding, the validator tries to prove or disprove the claim: it finds the source→sink path, then searches for sanitizers, parameterization, authorization checks, framework protections and contradicting tests. Result: VERIFIED / PROBABLE / REJECTED with supporting and contradicting evidence, checks run, confidence and explanation."
        where="A finding → Validate tab (also exposed as endpoints and logged to validation runs for research)."
        evidence="AST windows around the sink, guard patterns in the source, knowledge-graph chains, and static analysis — not a second LLM opinion."
      />
      <Feature
        title="Automatic reproduction tests"
        what="Generates a minimal test that attempts to reproduce a suspected defect, then runs it in the sandbox. Outcomes: TEST_REPRODUCES_BUG, TEST_DOES_NOT_REPRODUCE, or TEST_FAILED_TO_EXECUTE (distinguishing assertion failures from infrastructure failures). The same test can run against the patched copy to power Proof of Fix."
        where="A finding → Reproduction panel → Generate &amp; run test."
        evidence="Rule templates plus the finding&apos;s source/sink evidence; execution happens in an isolated environment with resource limits."
      />
      <Feature
        title="Proof of Fix"
        what="Consolidates a patch&apos;s verification into one record: checks checklist (reproduction gone, tests pass, finding no longer detected, no new criticals), evidence before/after, changed files and lines, and a decision — VERIFIED FIX, REJECTED FIX, PARTIALLY_VERIFIED, or UNVERIFIABLE — derived from recorded execution, never from the LLM."
        where="A finding → Patches → Proof of fix."
        evidence="Verification runs, reproduction results, re-analysis output and regression checks from the sandbox."
      />
      <Feature
        title="Finding deduplication"
        what="Groups duplicate observations of the same underlying defect into one logical finding (e.g., the same SQL injection reported by the static analyzer, the data-flow analyzer and the LLM) so dashboards count defects, not tool noise."
        where="Scan page → root-cause clusters (expandable)."
        evidence="Stable fingerprints from rule + file + symbol + normalized location."
      />
      <Feature
        title="SARIF export"
        what="Exports scan findings as SARIF 2.1.0 — rule IDs, severity→level mapping, fingerprints, and snippet regions. REJECTED findings are never exported as active security results; VERIFIED/PROBABLE status is preserved in properties."
        where="Scan → Export SARIF (download)."
        evidence="Persisted findings and their evidence; designed so the same output can later be uploaded to GitHub Code Scanning."
      />

      <H2 id="assistant">Repository assistant</H2>
      <Feature
        title="Natural-language query & per-finding chat"
        what="Ask about hotspots, ownership, health, callers, dependencies, architecture, tests, or the latest findings and receive answers built from the repository index with cited sources — plus a finding-scoped chat that includes the finding&apos;s evidence. If a question cannot be answered from evidence, it says so."
        where="Repository → Ask (also reachable via Ask RepoVeriX on the dashboard); a finding → Ask tab."
        evidence="Deterministic retrieval over the index (graph, health, git analytics, wiki, architecture, findings). Answers carry file/symbol/line references where available — no invented files."
      />

      <H2 id="research">Research engines</H2>
      <Feature
        title="Controlled multi-agent analysis"
        what="Five specialized analysts — security, quality, churn, architecture, dependencies — score the same repository evidence and correlate converging signals into a weighted overall risk with recommendations."
        where="Repository → Research → Multi-agent."
        evidence="Deterministic scoring functions over the shared evidence index; converging evidence is recorded per file."
      />
      <Feature
        title="Benchmark & experiments"
        what="The four experiment configurations, benchmark repositories with known defects, and evaluation scripts that compute precision, recall, F1, false-positive rate and patch correctness from real runs."
        where="Docs → RepoVeriX-Bench; scripts under the repository&apos;s experiments directory."
        evidence="Validation runs and research logs persisted by the engines above — numbers come from recorded runs only."
      />

      <Callout kind="info">
        Prefer the shortest path to any feature: after a scan completes, open a finding and use the
        tabs in order — Evidence → Validate → Ask → Patches/Proof of fix. That is the whole
        LLM-proposes / evidence-supports / execution-verifies loop on one screen.
      </Callout>
    </>
  );
}
