/**
 * Comparison pages for /compare — honest, category-level comparisons against
 * the tool classes a buyer actually shortlists. Every "RepoVeriX" claim must
 * map to real pipeline behavior; the "other tools" column describes the
 * category's typical behavior, never a specific vendor's private internals.
 */

export interface CompareRow {
  capability: string;
  /** The category's typical behavior. */
  them: string;
  /** RepoVeriX's actual behavior — must be demonstrable. */
  us: string;
}

export interface Comparison {
  slug: string;
  vs: string;
  title: string;
  description: string;
  /** What these tools are, one sentence. */
  whatTheyAre: string;
  /** When the category is the right choice. */
  chooseThem: string[];
  /** When RepoVeriX is the better fit. */
  chooseUs: string[];
  rows: CompareRow[];
  proof: { label: string; href: string }[];
}

export const COMPARISONS: Comparison[] = [
  {
    slug: 'semgrep',
    vs: 'Semgrep',
    title: 'Semgrep vs RepoVeriX: pattern matching vs validated evidence',
    description:
      'Semgrep matches patterns fast; RepoVeriX grounds findings in evidence chains, validates them with counterexample checks, and verifies generated fixes by executing your tests. A feature-level comparison with honest trade-offs.',
    whatTheyAre:
      'Semgrep is a fast, rule-based pattern matcher: rules describe code shapes and Semgrep finds every match.',
    chooseThem: [
      'You want thousands of community rules and CI-blocker speed on huge monorepos.',
      'Your workflow is "engineer triages raw matches" and that triage capacity exists.',
    ],
    chooseUs: [
      'You want each finding to carry its source-to-sink evidence chain, not just a match location.',
      'You want counterexample validation (sanitizer found → REJECTED with proof) to cut false positives before review.',
      'You want candidate fixes verified by executing your test suite in a sandbox before anything is called fixed.',
    ],
    rows: [
      {
        capability: 'Detection model',
        them: 'Pattern/rule matching over code syntax — fast and extensible.',
        us: 'AST detectors + call-graph data flow + LLM reasoning, every claim validated against repository evidence.',
      },
      {
        capability: 'Finding output',
        them: 'Rule ID, location, message.',
        us: 'Location + evidence chain (source → transformation → sink with code excerpts) + confidence + validation status.',
      },
      {
        capability: 'False-positive handling',
        them: 'Rule metadata and manual triage; autofix where rules define one.',
        us: 'Counterexample validator hunts for sanitizers/parameterized sinks and records REJECTED with the refuting evidence.',
      },
      {
        capability: 'Fixes',
        them: 'Autofix patterns defined per rule.',
        us: 'LLM-generated candidate patches certified by executing reproduction tests + your suite + detector re-analysis in a sandbox.',
      },
      {
        capability: 'Change impact',
        them: 'Out of scope — Semgrep analyzes files/paths in isolation.',
        us: 'Blast radius over the call graph, affected tests, missing co-changes from git history.',
      },
    ],
    proof: [
      { label: 'Evidence chains, not vibes', href: '/blog/evidence-chains-not-vibes' },
      { label: 'How a fix gets verified', href: '/blog/how-a-fix-gets-verified' },
      { label: 'What a validated finding looks like', href: '/vulnerabilities/sql-injection' },
    ],
  },
  {
    slug: 'snyk',
    vs: 'Snyk',
    title: 'Snyk vs RepoVeriX: dependency databases vs code-level reachability',
    description:
      'Snyk excels at known-vulnerability databases across dependencies and containers; RepoVeriX asks the harder question — is the vulnerable code reachable from yours — and validates everything at the code level.',
    whatTheyAre:
      'Snyk is a vulnerability-database platform: it matches your dependency manifests and images against advisory feeds.',
    chooseThem: [
      'You need broad advisory coverage across many ecosystems, containers and IaC.',
      'Compliance reporting over dependency inventories is the primary job.',
    ],
    chooseUs: [
      'You need to know whether a vulnerable dependency is actually reachable from your code, not just present.',
      'You want first-party code defects (not just dependency CVEs) validated with evidence.',
      'You want fixes proven by execution rather than suggested as version bumps.',
    ],
    rows: [
      {
        capability: 'Primary signal',
        them: 'Version ranges matched against advisory databases.',
        us: 'Code-level analysis: imports, call graph, data flow through your repository.',
      },
      {
        capability: 'Dependency findings',
        them: '"Dependency X 1.2.3 has CVE-Y" — presence-based.',
        us: 'Reachability analysis: directly reachable / indirectly reachable / not reachable / unknown — with the call-path evidence.',
      },
      {
        capability: 'First-party code',
        them: 'Limited SAST coverage.',
        us: 'Full pipeline: detectors, evidence chains, counterexample validation, LLM reasoning under validation.',
      },
      {
        capability: 'Fixes',
        them: 'Upgrade suggestions from the advisory database.',
        us: 'Generated patches verified by executing your tests; upgrade advice where that is the actual fix.',
      },
    ],
    proof: [
      { label: 'Reachability explained', href: '/glossary/reachability' },
      { label: 'Sample fixture scan', href: '/vulnerable-repos/vulnerable-app' },
    ],
  },
  {
    slug: 'codeql',
    vs: 'CodeQL',
    title: 'CodeQL vs RepoVeriX: query power vs verified outcomes',
    description:
      'CodeQL is the deep end of static analysis — a query language over databases of code. RepoVeriX wraps detection, validation and verified repair into one product pipeline with statuses you can defend.',
    whatTheyAre:
      'CodeQL treats a repository as a queryable database; security researchers write queries in a Datalog-like language to find complex taint flows.',
    chooseThem: [
      'You have (or are) security researchers who write and maintain custom queries.',
      'Deep, language-broad taint analysis matters more than workflow and validation.',
    ],
    chooseUs: [
      'You want analysis + validation + repair as a product, not a framework that needs a research team.',
      'You want findings to arrive pre-validated (VERIFIED/PROBABLE/REJECTED) with counterexample evidence.',
      'You want patch candidates proven by executing your tests before a fix is claimed.',
    ],
    rows: [
      {
        capability: 'Model',
        them: 'Write and run queries over a code database — maximal flexibility, minimal product surface.',
        us: 'Productized pipeline: detectors → evidence → LLM proposals → validation → sandbox-verified repair.',
      },
      {
        capability: 'Who validates findings',
        them: 'The query author encodes filters; a human triages the rest.',
        us: 'The validator does it per-finding: sanitizers, parameterized sinks, auth checks — status is computed, not declared.',
      },
      {
        capability: 'Repair',
        them: 'Not a CodeQL capability.',
        us: 'Patch generation grounded in the evidence chain, verified by execution in a sandbox.',
      },
      {
        capability: 'Accessibility',
        them: 'Powerful for experts; steep for teams without query-language skills.',
        us: 'Evidence-first UX aimed at developers reviewing a diff, not writing queries.',
      },
    ],
    proof: [
      { label: 'The verification pipeline', href: '/blog/how-a-fix-gets-verified' },
      { label: 'Measured, not claimed', href: '/blog/measuring-the-auditor' },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
