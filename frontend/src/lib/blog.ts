/**
 * Blog registry for RepoVeriX.
 *
 * Posts are structured (not MDX) so the whole blog builds statically with
 * zero extra dependencies. Content must stay factual: every claim maps to a
 * real pipeline behaviour (verify.py pipeline, evidence engine, bench harness).
 */

export interface BlogSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  tags: string[];
  readMinutes: number;
  sections: BlogSection[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-a-fix-gets-verified',
    title: 'How a fix gets verified',
    description:
      'An LLM-generated patch is a hypothesis, not a fix. Here is the exact pipeline RepoVeriX runs before it will call anything VERIFIED.',
    date: '2026-09-06',
    tags: ['verified repair', 'sandbox', 'pipeline'],
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          'Most "AI fixes your bugs" demos stop at the diff. A generated patch that looks plausible is not a fix — it is a hypothesis. RepoVeriX treats it that way: no patch is called verified until a deterministic pipeline has executed against it and the evidence agrees.',
        ],
      },
      {
        heading: 'The pipeline',
        bullets: [
          'A candidate patch is generated for a verified finding — grounded in the evidence chain, not the whole repository.',
          'The patch is applied to an isolated copy of the repository. Your branch is never touched.',
          'Dependencies are installed inside a disposable sandbox container with CPU, memory, PID and time limits; the host environment is stripped.',
          'The original reproduction test runs — it must fail on the vulnerable code and pass on the patched copy.',
          'The repository test suite runs. A fix that breaks something else is a regression, not a fix.',
          'Static checks re-run. The patch must not introduce new issues.',
          'The same detectors that produced the finding re-run. The finding must be gone.',
        ],
      },
      {
        heading: 'Deterministic verdicts',
        paragraphs: [
          'The outcome is one of a fixed set: VERIFIED FIX, PARTIALLY VERIFIED, REJECTED FIX, or UNVERIFIABLE. Each verdict records what ran, what passed, and what failed — the proof record stays attached to the finding so a reviewer can audit the decision later.',
          'If the environment prevents meaningful execution, the verdict is UNVERIFIABLE — never silently "success". A fix is only ever certified by execution, not because a model sounded confident.',
        ],
      },
      {
        heading: 'Why the re-analysis step matters',
        paragraphs: [
          'Running tests is not enough. A patch can make tests pass while leaving the vulnerable pattern reachable through another path. Re-running the original detectors on the patched copy closes that gap: the specific finding that started the process must actually disappear.',
        ],
      },
    ],
  },
  {
    slug: 'evidence-chains-not-vibes',
    title: 'Evidence chains, not vibes',
    description:
      'Why every RepoVeriX finding carries a source-to-sink chain, a counterexample check, and a status that is computed rather than declared.',
    date: '2026-09-05',
    tags: ['evidence', 'validation', 'false positives'],
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          'A scanner that says "SQL injection in services/user.py:88" without showing the untrusted input, the transformations, and the sink is asking you to trust it. Trust is exactly what an audit cannot rely on. RepoVeriX findings carry their proof with them.',
        ],
      },
      {
        heading: 'The chain',
        paragraphs: [
          'Every security finding links a chain of real locations: where untrusted input enters, how it flows through functions, and where it reaches the dangerous operation — each step backed by file, symbol and line. You can expand every step and read the code.',
        ],
      },
      {
        heading: 'The validator tries to disprove',
        paragraphs: [
          'The LLM proposes; the validator disposes. Before a finding reaches you, a validation engine searches for evidence that contradicts the claim: sanitization or validation on the path, authorization checks, exception handling, framework protections, and tests that exercise the behaviour.',
          'If a sanitizer provably guards the sink, the finding is REJECTED — and the counterexample (request → controller → validation → parameterized query) is recorded with the exact lines. Proof of absence is as valuable as proof of presence: it tells you where not to spend your afternoon.',
        ],
      },
      {
        heading: 'Statuses are computed, not declared',
        bullets: [
          'VERIFIED — sufficient evidence supports the claim, including targeted static analysis.',
          'PROBABLE — concerning and incomplete; the gaps are stated, not hidden.',
          'REJECTED — repository evidence contradicts the claim; the counterexample is kept.',
        ],
      },
      {
        heading: 'The feedback loop',
        paragraphs: [
          'You can mark any finding correct, incorrect, or already fixed. Verdicts are stored per finding and user, then folded into rule statistics — so the false-positive rate is measured from real usage, not asserted in a demo. The fastest way to improve a detector is to let it be wrong in public, measurably.',
        ],
      },
    ],
  },
  {
    slug: 'measuring-the-auditor',
    title: "Measure, don't claim: the RepoVeriX-Bench harness",
    description:
      'The research claim is not "an LLM finds bugs". It is that evidence + reasoning + verification measurably beats either alone — and the harness to prove it ships with the product.',
    date: '2026-09-04',
    tags: ['research', 'benchmark', 'RepoVeriX-Bench'],
    readMinutes: 4,
    sections: [
      {
        paragraphs: [
          'Security-tool marketing runs on anecdotes. RepoVeriX takes a different position: every published result comes from a real, reproducible run. The benchmark harness is part of the codebase, not a separate lab.',
        ],
      },
      {
        heading: 'Four configurations',
        bullets: [
          'Static only — deterministic detectors, no model.',
          'LLM only — model reasoning over raw code.',
          'Static + LLM — detectors propose, the model reasons over candidate findings.',
          'Full RepoVeriX — static + LLM + the evidence graph + validation + verification.',
        ],
      },
      {
        heading: 'Metrics that matter',
        paragraphs: [
          'Each configuration is scored on precision, recall, F1, false-positive rate, patch correctness and verification success — plus tokens and cost, because a system that is accurate but unaffordable is not a system. The fixture repositories (vulnerable_app, vulnerable_js, and their fixed companions) carry ground truth, so every metric is computed against known defects rather than eyeballed.',
          'Research logging records the configuration, prompt version, model, counts of verified/probable/rejected findings and timing for every run. Comparisons are apples-to-apples or they are worthless.',
        ],
      },
      {
        heading: 'What we expect to find',
        paragraphs: [
          'Static-only is precise but blind to logic; LLM-only finds interesting things and hallucinates; the full pipeline costs more tokens and produces fewer false positives per verified defect. If the data disagrees, the data wins — that is the point of building the harness.',
        ],
      },
    ],
  },
  {
    slug: 'fix-sql-injection-python',
    title: 'How to find and fix SQL injection in Python (with proof)',
    description:
      'The three patterns that create SQL injection in Python code, how to fix each one correctly, and how to prove the fix works — parameterized queries, identifier maps and the verification pipeline.',
    date: '2026-09-08',
    tags: ['sql injection', 'python', 'how-to'],
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          'SQL injection is the most-searched vulnerability class for a reason: it is still everywhere, and the fixes that look right often are not. This is the practical version — the three patterns that cause it, the fix for each, and how to prove the fix rather than assume it.',
        ],
      },
      {
        heading: 'Pattern 1: the f-string query',
        bullets: [
          'query = f"SELECT * FROM users WHERE name = \'{name}\'" followed by cursor.execute(query) — the classic. User input becomes SQL syntax.',
          'Fix: cursor.execute("SELECT * FROM users WHERE name = ?", (name,)). The driver binds the value; it can change the data, never the query structure.',
          'Prove it: a reproduction test with name = "x\' OR 1=1 --" must return zero rows after the fix (and unexpected rows before).',
        ],
      },
      {
        heading: 'Pattern 2: the helper that hides the sink',
        bullets: [
          'build_query(name) returns the f-string and the route handler executes it. The injection exists in both files; fixing only the route does nothing.',
          'Fix the construction site, not the call site — and check the call graph for other callers of the same helper while you are there.',
        ],
      },
      {
        heading: 'Pattern 3: the identifier you cannot parameterize',
        bullets: [
          'Table and column names cannot be bound parameters. f"SELECT * FROM {table}" is unfixable with placeholders.',
          'Fix: map allowed identifiers server-side — COLUMNS = {"name": "name", "email": "email"} and look up before interpolating. Anything not in the map is rejected.',
        ],
      },
      {
        heading: 'What “fixed” actually requires',
        paragraphs: [
          'A fix is verified when the reproduction test fails before and passes after, the rest of the suite still passes, static checks are clean, and the detector that found the issue re-runs and reports it gone. A parameterized sink should also flip the counterexample check: the validator now records the parameterization as proof-of-absence.',
          'The full verification pipeline — sandbox, tests, re-analysis — is described in How a fix gets verified. The class page for SQL injection shows vulnerable and fixed code from a real fixture repository, including the helper-function variant.',
        ],
      },
    ],
  },
  {
    slug: 'false-positives-kill-scanners',
    title: 'False positives are why developers ignore scanners',
    description:
      'A scanner nobody trusts is shelfware. Where false positives come from, why raw pattern matching cannot avoid them, and the validation ladder that fixes the signal-to-noise ratio.',
    date: '2026-09-08',
    tags: ['false positives', 'validation', 'evidence'],
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          'Every security team has the same story: the scanner reported 4,000 findings, engineers burned a sprint on them, two were real — and the report has been ignored ever since. The failure was not detection; it was publishing unvalidated output.',
        ],
      },
      {
        heading: 'Where false positives come from',
        bullets: [
          'Pattern without provenance: the query is built with string interpolation — but the value is an internal constant, not user input.',
          'Path without reachability: the sink is dangerous, but no route ever calls it.',
          'Sanitizer blindness: the flow passes through a parameterized call or a validation function the matcher does not model.',
        ],
      },
      {
        heading: 'The validation ladder',
        paragraphs: [
          'Each rung removes a class of false positives, and each is checkable by machine:',
        ],
        bullets: [
          'Evidence: record the source → transformation → sink path with locations. Unreviewable claims become reviewable ones.',
          'Counterexamples: actively search for what would disprove the finding — parameterized sinks, sanitizers, authorization checks. Found? REJECTED, with the refuting evidence recorded.',
          'Reachability: is the source external-reachable? An internet route is a different risk class than an admin-only path.',
          'Honest status: proof complete → VERIFIED; concerning but incomplete → PROBABLE; contradicted → REJECTED. Never publish a bare “high confidence” number as if it were proof.',
        ],
      },
      {
        heading: 'Measure the result',
        paragraphs: [
          'Precision (share of findings that are real) and recall (share of real defects found) are the two numbers that decide whether a scanner survives contact with a development team. A pipeline that emits fewer findings but verifies them is strictly more useful than one that emits everything it can match — which is the whole argument for validating before publishing.',
          'Related: how evidence chains are recorded, and what a counterexample check looks like on a real finding.',
        ],
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
