/**
 * Glossary for /glossary — definitions of terms developers actually search
 * ("what is a sink", "what does SARIF mean"), each written to be correct in
 * general and, where marked, linked to how RepoVeriX implements the concept.
 * No invented product claims: the "in RepoVeriX" notes describe real behavior.
 */

export interface GlossaryTerm {
  slug: string;
  term: string;
  short: string;
  body: string[];
  /** Optional pointer into the product docs/knowledge base. */
  related?: { label: string; href: string }[];
  category: 'security' | 'analysis' | 'standards' | 'process';
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: 'evidence-chain',
    term: 'Evidence chain',
    short: 'The recorded path of facts that shows why a finding is true.',
    body: [
      'A finding that only says "SQL injection in app.py:42" forces you to trust the scanner. An evidence chain shows the work instead: the source where untrusted input enters, each transformation it passes through, and the sink where the dangerous operation happens — with file, line and code excerpt for every step.',
      'With a chain, a reviewer can accept or reject a finding in seconds by reading the recorded path, and automated validators can check each hop against the code. Without one, every report is an appeal to authority.',
    ],
    related: [
      { label: 'Concepts & evidence', href: '/docs/concepts' },
      { label: 'How RepoVeriX records chains', href: '/vulnerabilities/sql-injection' },
    ],
    category: 'analysis',
  },
  {
    slug: 'source',
    term: 'Source (taint source)',
    short: 'Where untrusted data enters a program: request parameters, files, environment, network.',
    body: [
      'In data-flow analysis, a source is any point where data originates outside the program\'s control — an HTTP query parameter, a request body, an uploaded file\'s name, a message-queue payload, a CLI argument. Data from a source is "tainted" until something proves otherwise.',
      'Whether a source is external-reachable (an internet-facing route vs an internal admin endpoint) is often the difference between a critical and a theoretical finding.',
    ],
    related: [{ label: 'Attack paths: source to sink', href: '/vulnerabilities/command-injection' }],
    category: 'security',
  },
  {
    slug: 'sink',
    term: 'Sink',
    short: 'Where tainted data becomes dangerous: SQL execution, shell exec, eval, filesystem writes.',
    body: [
      'A sink is an operation whose safety depends on its inputs: cursor.execute() for SQL, exec() or subprocess with a shell for OS commands, eval() for code, file writes for paths, HTML rendering for XSS. Security analysis is largely the question "can untrusted data reach a sink without being neutralized on the way?"',
      'Not every tainted path to a sink is exploitable — which is why claims need validation, not just pattern matching.',
    ],
    related: [{ label: 'What a real sink finding carries', href: '/vulnerabilities/sql-injection' }],
    category: 'security',
  },
  {
    slug: 'counterexample-validation',
    term: 'Counterexample validation',
    short: 'Actively searching for proof a finding is wrong before believing it is right.',
    body: [
      'Most scanners stop at "the pattern matched". Counterexample validation goes the other direction: for a candidate finding, the validator hunts for evidence that would refute it — a parameterized query at the sink, a sanitizer on the path, an authorization check, a type coercion.',
      'If a counterexample is found, the finding is rejected (and the refuting evidence is recorded, so the decision itself is auditable). If no counterexample exists but proof is incomplete, the honest status is PROBABLE, not VERIFIED. This is the single biggest lever on false-positive rates.',
    ],
    related: [{ label: 'Counterexamples in practice', href: '/vulnerabilities/sql-injection' }],
    category: 'process',
  },
  {
    slug: 'blast-radius',
    term: 'Blast radius',
    short: 'Everything a code change could affect: callers, dependents, tests, endpoints.',
    body: [
      'Blast radius is the set of code a change can break: functions that call the changed one (directly or through the call graph), modules that import it, APIs that expose it, and tests that exercise it. A one-line change to a widely-called helper has a large blast radius; the same change in a leaf utility has almost none.',
      'Computed over a call graph and import graph (not string searches), blast radius is what turns "review this diff" into "here are the 14 callers and 3 tests your change may break".',
    ],
    category: 'analysis',
  },
  {
    slug: 'sarif',
    term: 'SARIF',
    short: 'Static Analysis Results Interchange Format — the standard JSON format for scanner results (SARIF 2.1.0, OASIS standard).',
    body: [
      'SARIF is the interchange format for static-analysis output: rules, results, locations, severities and fingerprints in one schema. GitHub Code Scanning ingests it natively, as do VS Code extensions and most enterprise security dashboards.',
      'A scanner that exports SARIF drops into toolchains instead of demanding its own dashboard. Fingerprints matter in practice: stable identity per finding lets the receiving platform track "new / still present / fixed" across runs even when line numbers move.',
    ],
    related: [{ label: 'Exporting SARIF from RepoVeriX', href: '/docs/features#health' }],
    category: 'standards',
  },
  {
    slug: 'reachability',
    term: 'Reachability (dependency vulnerability)',
    short: 'Whether your code actually calls the vulnerable function of a vulnerable dependency.',
    body: [
      '"Dependency X has CVE-2024-1234" is a statement about a version number. Reachability asks the question that matters: does any code path in your repository actually invoke the vulnerable functionality? A vulnerable function you never call cannot be exploited through your application.',
      'The honest output has four states — directly reachable, reachable through dependencies, not reachable, and unknown — and "not reachable" must be proven (call-graph analysis), not merely "a search found nothing".',
    ],
    category: 'security',
  },
  {
    slug: 'code-hotspot',
    term: 'Code hotspot',
    short: 'A file that changes frequently and carries defect history — where bugs concentrate.',
    body: [
      'Hotspot analysis combines churn (how often a file changes) with defect signals (how many of those changes were bug fixes). Files with high recency-decayed churn and high fix-ratio are where the next defect is statistically most likely — far better prioritization signal than raw code metrics alone.',
      'Related: bus factor — how many authors actually know a file. A one-author hotspot is a maintenance risk regardless of its code quality.',
    ],
    category: 'analysis',
  },
  {
    slug: 'false-positive-rate',
    term: 'False positive rate',
    short: 'The share of findings that are not real. The metric that decides whether anyone trusts a scanner.',
    body: [
      'A scanner\'s value is not how many findings it emits but how many of them are real. A high false-positive rate has a known consequence: developers stop reading the report. That is why serious measurement separates precision (share of findings that are true) from recall (share of true defects that were found), and tracks the false-positive rate explicitly.',
      'The cheapest way to reduce false positives is to validate before publishing: search for sanitizers and parameterized sinks (counterexamples), check reachability, and let the status (VERIFIED / PROBABLE / REJECTED) carry the confidence honestly.',
    ],
    related: [{ label: 'How RepoVeriX validates findings', href: '/blog/evidence-chains-not-vibes' }],
    category: 'process',
  },
  {
    slug: 'proof-of-fix',
    term: 'Proof of fix',
    short: 'Executable evidence that a patch actually repaired the defect — not a model\'s opinion.',
    body: [
      'An LLM-generated diff that looks correct is a hypothesis. Proof of fix is the executed experiment: apply the patch to an isolated copy, run the reproduction test (it must fail before and pass after), run the repository\'s own test suite, re-run static checks, and re-run the detector that produced the finding — it must report it gone.',
      'Only when those checks pass is a fix VERIFIED; partial environments produce PARTIALLY_VERIFIED or UNVERIFIABLE — never a silent success. The verdict record stays attached to the finding so a reviewer can audit the decision later.',
    ],
    related: [{ label: 'The verification pipeline', href: '/blog/how-a-fix-gets-verified' }],
    category: 'process',
  },
  {
    slug: 'sbom',
    term: 'SBOM',
    short: 'Software Bill of Materials — the machine-readable inventory of every component in a build.',
    body: [
      'An SBOM lists every dependency (direct and transitive) in a standardized format (SPDX or CycloneDX). It is the foundation for reachability analysis: you cannot ask "does my code use the vulnerable function of dependency X?" without first knowing X is there and what version.',
      'SBOMs turn "we think we use log4j somewhere" into a queryable fact — which is why they have become a procurement and compliance requirement.',
    ],
    category: 'standards',
  },
  {
    slug: 'hardcoded-secrets',
    term: 'Hardcoded secrets',
    short: 'Credentials committed into source code — the most common and most preventable leak.',
    body: [
      'API keys, tokens and passwords embedded directly in source code leak through repository access, forked copies, CI logs and forgotten history. Detection is pattern-based (key formats, assignment to constants, entropy heuristics) and every match deserves a finding because the fix is mechanical: move the value to a secret manager or environment variable, then rotate the credential — deleting it from the file does not un-leak the git history.',
      'Demo credentials in fixture repositories should be marked fake explicitly (in a README), so scanners and humans can tell test data from real leaks.',
    ],
    related: [{ label: 'What the detector matches', href: '/detections/rvx-secret-001' }],
    category: 'security',
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}
