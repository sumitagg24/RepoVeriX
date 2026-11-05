"""Chapters 11-19, references and appendices of the RepoVeriX project report."""

from __future__ import annotations

FIG = "../figures"

CHAPTERS: list[dict] = []

# ====================================================================== CHAPTER 11
CHAPTERS += [
    {"t": "h1", "num": "11", "title": "Implementation Methodology"},
    {"t": "h2", "num": "11.1", "title": "Development approach"},
    {"t": "p", "text":
     "The project was built as an incrementally hardened vertical slice rather than as a sequence of horizontal "
     "layers. The first working version could ingest a repository, parse it, apply one detector and persist a "
     "finding; every subsequent increment added one capability to a pipeline that already ran end to end. This is "
     "visible in the shape of the repository: the core analysis modules have a stable interface and a long history "
     "of refinement, while later capabilities — organisations, website audits, research extensions — were added as "
     "additional modules with minimal disturbance to the core. The commit history in the local checkout is "
     "squashed for distribution, but the module docstrings record the tier in which each capability was "
     "introduced, which preserves the development narrative in the code itself."},
    {"t": "p", "text":
     "The methodology has three distinguishing features. First, every capability arrives with a test module: the "
     "suite contains fifty-one modules and five hundred and forty-four test functions, and the modules are named "
     "after the behaviour they defend rather than after the file they exercise. Second, every security decision is "
     "documented at the point of implementation as well as in the hardening notes, so the design rationale survives "
     "the code. Third, the documentation set — thirteen documents covering architecture, pipeline, evidence, "
     "verification, security, database, API, website audits, experiments, development, deployment, manual setup "
     "and a deployment guide — was treated as a deliverable rather than an afterthought, which is why this report "
     "could be written primarily from the repository rather than from memory."},

    {"t": "h2", "num": "11.2", "title": "Technology choices and their justification"},
    {"t": "table", "caption": "Technology stack with the reason for each choice",
     "source": "Source: Project repository — backend/pyproject.toml, frontend/package.json, Dockerfiles, documentation.",
     "cols": [18, 32, 50],
     "head": ["Layer", "Technology", "Justification recorded in the project"],
     "rows": [
         ["Backend runtime", "Python 3.12 with FastAPI", "Native asynchronous handling matches the I/O-bound shape of cloning, provider calls and subprocess execution; typed request and response models generate accurate documentation."],
         ["Data access", "SQLAlchemy 2 with an async driver", "Typed declarative models over an async engine; the same models serve PostgreSQL in production and SQLite in development and tests."],
         ["Parsing", "tree-sitter with language grammars", "A uniform concrete syntax tree across three languages, with node mappings per language so the pipeline stays language-agnostic."],
         ["Static tools", "Built-in rules plus optional adapters", "Deterministic floor that needs no installation; external tools add depth when present and never block a scan."],
         ["Model access", "Provider abstraction with six implementations", "Vendor independence, an offline mock for tests, and an ordered fallback chain when one provider is unavailable."],
         ["Execution isolation", "Docker with resource limits", "The only sound boundary for running untrusted project code; limits and a minimal environment are configuration, not convention."],
         ["Frontend", "Next.js App Router, TypeScript, Tailwind, component primitives", "Server-state separation, typed API contracts, and a component model that keeps pages compositional."],
         ["Deployment", "Container images, compose files, a reverse proxy", "A three-part stack that a single operator can run, with a documented path to managed database and frontend hosting."],
         ["Continuous integration", "GitHub Actions with lint, tests, dependency audit and image publishing", "Formatting and lint are enforced rather than advisory; images are published on a successful push to the main branch."],
     ]},

    {"t": "h2", "num": "11.3", "title": "Development environment"},
    {"t": "p", "text":
     "The documented local setup needs only Python, Node and optionally Docker. The backend is installed into a "
     "virtual environment from its packaging metadata, which declares the runtime dependencies and a development "
     "extra containing the test runner and the linter. Environment configuration is copied from a template that "
     "lists every variable with a placeholder value and a comment; the template is the only environment file in "
     "version control, and the real file is ignored. The database defaults to PostgreSQL, so a laptop run must "
     "either start the compose stack or opt into SQLite with a one-line connection string, and the documentation "
     "says so explicitly rather than letting a new developer discover it. The frontend installs from a lockfile so "
     "that dependency resolution is reproducible."},
    {"t": "p", "text":
     "Two conventions keep the environment honest. The linter is configured to format at a fixed line width and "
     "the continuous-integration pipeline runs the formatter in check mode, so formatting is a build condition "
     "rather than a preference. And the test suite runs with rate limiting disabled through configuration, which "
     "means the tests exercise behaviour rather than the abuse defences; the defences have their own dedicated "
     "tests that enable the limiter deliberately."},

    {"t": "h2", "num": "11.4", "title": "Beyond the minimum viable product"},
    {"t": "p", "text":
     "The repository readme describes the shipped system as an MVP and then lists what the MVP is not. That "
     "description is accurate about the analysis engine but understates the surrounding product surface, which "
     "includes organisations and role-based access, personal API tokens, onboarding, billing entitlements, "
     "feedback and sharing, change and pull-request auditing, repository intelligence and a set of research "
     "extensions. The practical consequence for this report is that the system can be evaluated both narrowly — "
     "as a detection-and-repair pipeline — and broadly, as a developer-facing auditing workspace. Chapters 12 and "
     "13 do both, keeping the categories separate so that a strength in one is not mistaken for a claim in the "
     "other."},
    {"t": "p", "text":
     "The extensions are explicitly labelled as research features in their own module documentation and are "
     "numbered there, which is a useful honesty device: a reviewer reading the multi-agent analysis module learns "
     "immediately that it is a research capability rather than a load-bearing part of the pipeline. This report "
     "follows the same discipline by describing them in one subsection rather than implying that every "
     "demonstration of the system depends on them."},

    {"t": "h2", "num": "11.5", "title": "Work breakdown"},
    {"t": "table", "caption": "Work breakdown by phase and the artefacts each produced",
     "source": "Source: author's reconstruction from the repository structure, module docstrings and documentation set.",
     "cols": [8, 26, 38, 28],
     "head": ["Phase", "Focus", "Principal artefacts", "Verification"],
     "rows": [
         ["1", "Repository ingestion and discovery", "Ingestion, discovery and process modules; archive security guards; manifest production.", "Ingestion tests covering traversal, size caps and archive type."],
         ["2", "Structural analysis", "Parser abstraction over three grammars; symbol and call knowledge graph; architecture-smell analysis.", "Parsing tests across languages; orchestrator tests that assert graph enrichment."],
         ["3", "Detection and adjudication", "Built-in rule set; external tool adapters; evidence chain construction; status semantics.", "Detector tests; evidence tests; counterexample validation tests."],
         ["4", "Reasoning integration", "Context builder; redaction; provider abstraction; versioned prompts; fallback chain.", "Provider tests including mock and failure paths; redaction tests."],
         ["5", "Repair and verification", "Deterministic templates; model repair; diff operations; sandboxed verification; proof-of-fix aggregation.", "Patch tests; verification tests; proof-of-fix tests."],
         ["6", "Product surface", "API routers; schema and migrations; authentication and authorisation; organisations and tokens.", "Route-level tests across twenty-two routers; security regression tests."],
         ["7", "Interface", "Next.js application across three route groups; components for evidence, remediation and verification.", "Type checking, unit tests for domain helpers, and build in continuous integration."],
         ["8", "Benchmark and deployment", "Experiment runner and metrics; seeded fixtures and ground truth; containers, compose files, pipelines.", "Benchmark tests; operational scripts and cadence workflow tests."],
     ]},
    {"t": "p", "text":
         "The work proceeded in eight increments, and each produced a capability that could be exercised end to end "
         "before the next began. Ingestion and discovery came first, with the archive guards and the manifest. "
         "Structural analysis followed: the parser over three grammars, then the knowledge graph, then the "
         "architecture-smell analysis that the graph made possible. Detection and adjudication came next as a pair, "
         "because a rule without an adjudicator cannot be evaluated and an adjudicator without rules has nothing to "
         "judge. Reasoning support followed, adding the context builder, redaction, the provider abstraction and the "
         "nine versioned prompts. Repair and verification formed the fifth increment, and they too were paired: a "
         "generator without a verifier would have produced the very artefact this project exists to avoid."},
        {"t": "p", "text":
         "The product surface came sixth, converting the engine into a service with routers, a schema, migrations, "
         "authentication and organisations. The interface came seventh. The benchmark and the deployment artefacts "
         "came last, and they are the increment that changed the project from a working application into an "
         "instrument, because they are what makes a claim about detection quality testable rather than rhetorical. "
         "The phases were not strictly sequential: verification was revisited whenever the evidence model changed, "
         "because the re-analysis step consumes the detector set and therefore inherits every rule refinement. That "
         "coupling is a design property rather than an accident — the pipeline's later stages are deliberately "
         "sensitive to earlier ones, which is what makes an end-to-end verdict meaningful."},
    {"t": "p", "text":
     "The phases were not strictly sequential. Verification, for example, was revisited whenever the evidence model "
     "changed, because the re-analysis step consumes the detector set and therefore inherits any rule refinement. "
     "This coupling is a design property rather than an accident: the pipeline's later stages are deliberately "
     "sensitive to earlier ones, which is what makes an end-to-end verdict meaningful and also what makes the "
     "benchmark a useful instrument."},
]

# ====================================================================== CHAPTER 12
CHAPTERS += [
    {"t": "h1", "num": "12", "title": "Testing Strategy"},
    {"t": "h2", "num": "12.1", "title": "Approach"},
    {"t": "p", "text":
     "Testing is organised by risk rather than by file. The highest densities of test functions are in the areas "
     "where a mistake is either a security defect or a false claim: authentication and account security, security "
     "hardening and regression, billing and entitlements, team and sharing features, tiered workflow behaviour, "
     "and website crawling. The suite is written with an asynchronous test runner and a fixture harness that "
     "creates an isolated application, a throwaway database and a temporary storage root per test, so tests cannot "
     "leak state into one another or into a developer's working directory."},
    {"t": "figure", "path": f"{FIG}/fig14_test_inventory.png", "width": 0.95,
     "caption": "Distribution of test functions across the functional areas of the system",
     "source": "Source: Project repository — measured from backend/tests (544 test functions in 51 modules)."},
    {"t": "p", "text":
     "It is important to be precise about what this chapter claims. The repository declares five hundred and "
     "forty-four test functions. The suite was not executed while this report was being prepared, so this report "
     "does not state a pass count, a coverage percentage or a duration. What it can state, and does, is which "
     "behaviours the tests defend and how they are constructed. A supervisor who wishes to confirm the suite can "
     "run the documented command; the repository's own continuous-integration configuration runs the same command "
     "on every push, and the documentation records seventy-nine tests at the time the readme was written, which "
     "shows that the suite has grown substantially since."},

    {"t": "h2", "num": "12.2", "title": "Levels of testing"},
    {"t": "table", "caption": "Testing levels, technique and representative modules",
     "source": "Source: Project repository — backend/tests and frontend/src (test files).",
     "cols": [16, 38, 46],
     "head": ["Level", "Technique", "Representative modules"],
     "rows": [
         ["Unit", "Direct calls to analysis functions with hand-built inputs and assertions on the returned value objects.",
          "Detector tests, parsing tests, patch operations, benchmark metrics, SARIF rendering, redaction."],
         ["Contract", "Route-level tests that assert status codes, response shapes and error semantics for a single endpoint.",
          "Repository, scan, finding, patch, token, onboarding and dashboard route tests."],
         ["Integration", "The real orchestrator over a fixture repository against a throwaway database, asserting persisted rows rather than return values.",
          "Orchestrator tests, proof-of-fix tests, reporting tests, regression tests."],
         ["Security", "Adversarial cases: path traversal, identifier enumeration, cross-user access, rate-limit exhaustion, injection-shaped input, webhook forgery.",
          "Ingestion tests, hardening tests, security regression tests, adversarial business-logic tests, rate-limit tests, authentication webhook tests."],
         ["End to end", "The documented flagship flow from sign-up through verification using a local execution runner instead of a container.",
          "Verification tests, production lifecycle tests."],
         ["Operational", "Scripts that check backups, dependency security, incident triage and the operations cadence, exercised against synthetic state.",
          "Operational cadence tests, production operations tests, supply-chain tests."],
         ["Frontend", "Unit tests for domain helpers, formatting and security utilities, plus type checking and a production build.",
          "Domain, format, security and utility test files; type-check in continuous integration."],
     ]},

    {"t": "h2", "num": "12.3", "title": "Test cases and expected outcomes"},
    {"t": "p", "text":
     "The table below records representative cases in the form used by the suite, with the expected outcome "
     "expressed as an assertion a reviewer could check by reading the module. Cases are grouped by the requirement "
     "they verify, which is what makes the traceability in Chapter 6 operational."},
    {"t": "table", "caption": "Representative test cases with expected outcomes",
     "source": "Source: Project repository — backend/tests (cases paraphrased from the modules; identifiers indicate the module area, not literal function names).",
     "cols": [10, 42, 34, 14],
     "head": ["Case", "Input", "Expected outcome", "Trace"],
     "rows": [
         ["TC-01", "An archive containing a member whose path is absolute.", "Upload rejected with an unsafe-archive reason; nothing extracted outside the storage root.", "FR-02, NFR-01"],
         ["TC-02", "An archive whose members contain parent-directory segments.", "Upload rejected; storage directory remains empty.", "FR-02, NFR-01"],
         ["TC-03", "A file uploaded with a .zip name but non-archive content.", "Rejected at magic-byte validation before extraction.", "FR-02"],
         ["TC-04", "A repository whose size exceeds the configured cap.", "Rejected with a readable limit message; no partial working copy retained.", "NFR-09"],
         ["TC-05", "A Python file containing a query assembled by f-string and executed on a cursor.", "A finding with the SQL-injection rule identifier, the sink location and at least a source and sink evidence node.", "FR-06, FR-10"],
         ["TC-06", "The same pattern expressed as a parameterised query.", "No finding; the detector does not match a bound-parameter call.", "FR-06"],
         ["TC-07", "A JavaScript module with a template-literal query passed to a client.", "Findings for the secret and query rules with JavaScript-suffixed identifiers.", "FR-06"],
         ["TC-08", "A file that the grammar cannot parse.", "Scan continues; a warning is recorded; other files are analysed normally.", "FR-05, NFR-09"],
         ["TC-09", "A scan started with no provider key configured.", "Deterministic stages complete; the reasoning stage is recorded as failed with an explanatory message; no fabricated model findings.", "FR-09, NFR-06"],
         ["TC-10", "A candidate whose sink is located but whose chain cannot be completed.", "Persisted as probable rather than verified, with the partial chain recorded.", "FR-10"],
         ["TC-11", "A candidate claim with no repository grounding.", "Rejected; the candidate is counted but not published as a finding.", "FR-10, NFR-06"],
         ["TC-12", "A template repair generated twice for an unchanged finding.", "The second generation is idempotent; findings are de-duplicated on the stable identifier.", "FR-12"],
         ["TC-13", "A generated diff whose target path escapes the repository root.", "Patch rejected before storage with a structured error.", "FR-13"],
         ["TC-14", "A patch that does not apply to the working copy.", "Verification records a failure at the apply step; the sandbox is deleted.", "FR-14"],
         ["TC-15", "A patch that applies, passes tests and removes the original rule.", "Verification resolves to a verified repair with per-test results attached.", "FR-14"],
         ["TC-16", "A patch that applies and passes tests but leaves the rule firing.", "Verification does not resolve to a verified repair, demonstrating that tests alone are insufficient.", "FR-14"],
         ["TC-17", "Verification requested when no container runtime is reachable.", "Recorded as not verified with a runner-unavailable explanation, never as a success.", "FR-14, NFR-06"],
         ["TC-18", "A second verification requested while one is in flight for the same patch.", "Conflict response; no duplicate run is created.", "FR-14"],
         ["TC-19", "A user requests a repository owned by another user.", "The same response as an anonymous request; no existence disclosure.", "NFR-07"],
         ["TC-20", "A member with the lowest role attempts to remove another member.", "Refused by the ranked role comparison.", "FR-18, NFR-07"],
         ["TC-21", "Repeated failed authentications beyond the configured budget.", "Refusals with an increasing retry delay; no permanent lockout; the account bucket clears on success.", "NFR-08"],
         ["TC-22", "A personal API token is created and then revoked.", "Only the hash is stored; the plaintext appears once at creation; the revoked token is refused immediately.", "FR-19"],
         ["TC-23", "A public share is created for a scan report.", "The payload excludes credentials and internal log detail; the identifier is unguessable.", "FR-16, NFR-03"],
         ["TC-24", "A website audit is requested for a hostname resolving to a private address.", "Refused by the SSRF preflight before any request is issued.", "FR-17"],
         ["TC-25", "A crawler encounters a disallowed path in robots.txt.", "The path is skipped and reported; no request is issued for it.", "FR-17"],
         ["TC-26", "A crawl is requested while an audit for the same site is running.", "Conflict response; targets are never crawled concurrently.", "FR-17"],
         ["TC-27", "A scan report is requested as Markdown.", "A rendered document is returned whose contents match the structured report payload.", "FR-15"],
         ["TC-28", "Findings are exported in the interchange format.", "A valid document with rule identifiers, locations and severity levels.", "FR-15"],
         ["TC-29", "Benchmark metrics computed for a configuration that produced no findings.", "Ratios are undefined rather than zero; the renderer prints TBD.", "FR-20, NFR-06"],
         ["TC-30", "A scan is cancelled while running.", "The orchestrator stops at the next stage boundary and records the cancelled state.", "FR-04"],
     ]},

    {"t": "h2", "num": "12.4", "title": "Testing the hard parts"},
    {"t": "p", "text":
     "Three subsystems resist ordinary testing and received specific treatment. The sandbox is tested through a "
     "runner seam: the verification engine accepts a runner object, production injects the container runner, and "
     "tests inject a local runner that executes the same steps against the sandbox copy. This means the "
     "verification logic — apply, baseline, tests, re-analysis, verdict — is exercised in continuous integration "
     "without a container daemon, while the container runner itself is a thin adapter whose behaviour is a "
     "configuration matter. The trade is documented rather than hidden: continuous integration proves the decision "
     "logic, not the isolation."},
    {"t": "p", "text":
     "The model integration is tested with a deterministic mock provider and with explicit failure injection: a "
     "timeout, a malformed JSON reply, a provider error. Each is expected to leave the scan alive and to record "
     "the failure against the candidate rather than the scan. Prompt-injection resistance is tested at the "
     "assembly boundary — repository text must appear only inside the data section — and secret redaction is "
     "tested against representative key shapes."},
    {"t": "p", "text":
     "The crawler is tested against the SSRF gate rather than against the public internet, because a test that "
     "depends on an external host is neither reproducible nor polite. The gate is exercised with private, "
     "loopback, link-local and metadata addresses, with redirect chains that would land on a forbidden address, "
     "and with userinfo-bearing URLs. Refusal is the expected outcome in every case, and the tests assert that no "
     "request was issued, which is the property that actually matters."},

    {"t": "h2", "num": "12.5", "title": "What the test suite cannot prove"},
    {"t": "p", "text":
     "A test suite proves that specified behaviour holds; it cannot prove that the specification is right. Four "
     "things remain outside its reach and are stated here so that no later chapter quietly assumes them. Detection "
     "quality — whether the rules find real defects without excessive noise — is a property of the corpus, not of "
     "the code, and is measured only by the benchmark. Repair correctness in the general case depends on the "
     "quality of the project's own tests, which varies per repository. Isolation is a property of the container "
     "configuration, which the seam-based tests deliberately substitute. And performance under load is not "
     "measured at all, because the documented deployment is single-instance and the system makes no throughput "
     "claim."},
    {"t": "p", "text":
     "Recording these gaps is not a concession; it is the same discipline the system applies to findings. A "
     "verification that could not establish a verdict is reported as such rather than as a pass, and a report "
     "about a verification system ought to hold itself to the standard it documents."},
]

# ====================================================================== CHAPTER 13
CHAPTERS += [
    {"t": "h1", "num": "13", "title": "Evaluation Methodology"},
    {"t": "h2", "num": "13.1", "title": "Research questions and hypotheses"},
    {"t": "p", "text":
     "The project defines four research questions and four matching hypotheses. They are stated in the repository's "
     "documentation in the same form used here, and the four audit configurations exist to answer them."},
    {"t": "table", "caption": "Research questions, hypotheses and the comparison that tests each",
     "source": "Source: Project repository — README.md (research questions) and docs/experiments.md (hypothesis mapping).",
     "cols": [8, 42, 22, 28],
     "head": ["RQ", "Question", "Hypothesis", "Comparison"],
     "rows": [
         ["RQ1", "How does repository-level context affect what a model can say about a defect?", "H1 — structural context improves detection quality.", "Model-only versus the full configuration."],
         ["RQ2", "Does combining static evidence with model reasoning beat either alone?", "H1 — the combination is better than either part.", "Model-only versus the hybrid configuration."],
         ["RQ3", "Does evidence validation reduce false positives?", "H2 — validation removes ungrounded claims.", "Raw candidate claims versus adjudicated findings, using the rejected-candidate count."],
         ["RQ4", "Does execution-based verification improve repair correctness?", "H4 — execution separates real fixes from plausible ones.", "Template repairs versus model repairs, scored by verification outcome."],
     ]},

    {"t": "h2", "num": "13.2", "title": "The benchmark apparatus"},
    {"t": "p", "text":
     "The apparatus is deliberately small and fully specified. Two fixture repositories ship with the project. The "
     "Python fixture is a deliberately vulnerable demonstration application containing six annotated defects: an "
     "injected SQL query, a hardcoded credential, a shell invocation with a constructed command, an evaluation of "
     "caller-supplied input, a weak hash used for token fingerprinting, and a broad exception handler that "
     "swallows errors. The JavaScript fixture contains four annotated defects: a hardcoded secret, a concatenated "
     "query, an interpolated command and a dynamic evaluation. Each defect is recorded in a ground-truth file with "
     "its file, function, starting line, rule family, severity, category and description. Every credential in "
     "both fixtures is fake, and the documentation states plainly that neither repository must ever be deployed."},
    {"t": "p", "text":
     "The experiment configuration declares the two repositories, their ground-truth files, the four "
     "configurations and a line tolerance of six lines for location matching. Each pair of repository and "
     "configuration is executed against the real orchestrator with a throwaway database and an isolated storage "
     "directory, so an experiment cannot contaminate the development environment. For each pair the runner writes "
     "a JSON artifact containing the findings, the stage-by-stage outcome, token usage and the reproducibility "
     "block, and a summary document containing the comparison table."},

    {"t": "h2", "num": "13.3", "title": "Metrics and matching rules"},
    {"t": "p", "text":
     "Scoring is defect-level with greedy one-to-one matching. A finding matches a ground-truth defect when three "
     "conditions hold: the file matches, the rule family matches — with language variants of the same family "
     "comparing equal, so a JavaScript injection finding matches the JavaScript ground-truth entry rather than the "
     "Python one — and either the enclosing function matches or the line falls within the tolerance window. Each "
     "defect can be matched at most once and each finding at most once, so a system that reports the same defect "
     "five times does not thereby improve its recall."},
    {"t": "table", "caption": "Metrics, definitions and the denominator that makes each undefined",
     "source": "Source: Project repository — backend/app/benchmark/metrics.py and docs/experiments.md.",
     "cols": [22, 42, 36],
     "head": ["Metric", "Definition", "Undefined when"],
     "rows": [
         ["Precision", "True positives divided by the sum of true and false positives.", "No findings were produced at all."],
         ["Recall", "True positives divided by the total number of annotated defects.", "The ground truth contains no defects."],
         ["F1", "Harmonic mean of precision and recall.", "Either precision or recall is undefined."],
         ["False-positive rate", "False positives divided by all findings.", "No findings were produced."],
         ["Patch correctness", "Proportion of generated patches that are the intended correction.", "No patches were generated, or no reference correction exists for the repository."],
         ["Verification success", "Proportion of verification runs that resolve to a verified repair.", "No verification run was executed."],
     ]},
    {"t": "p", "text":
     "The rule that undefined quantities remain undefined is worth emphasising because it is the mechanism that "
     "keeps the evaluation honest. A naive implementation returns zero for precision when there are no findings, "
     "which reads as catastrophic performance; the more serious error is to return one, which reads as perfect "
     "performance. Both are fabrications. Returning an explicit absence forces the summary to display TBD, and TBD "
     "cannot be quoted in a results table as though it were a measurement."},

    {"t": "h2", "num": "13.4", "title": "Protocol and controls"},
    {"t": "p", "text":
     "Four controls protect the comparison. The same orchestrator runs all four configurations, so no arm uses a "
     "different code path for detection. The same ground truth scores all four arms, so no arm is judged against a "
     "friendlier standard. Each run receives a fresh database and storage directory, so state cannot leak between "
     "arms. And the reproducibility block records the analyzer version, prompt version, model identity, tool "
     "versions, repository commit and timestamp, so a reported number can be traced to the configuration that "
     "produced it."},
    {"t": "p", "text":
     "One control is missing and is the most important gap in the evaluation design: repeated runs. Model output "
     "is not deterministic across providers and versions, so a single run per cell cannot separate an effect from "
     "noise. The documentation does not claim otherwise, and the recommended extension is to run each cell several "
     "times and report a distribution rather than a point. This report records that recommendation as part of the "
     "methodology rather than presenting a single run as though it were an estimate."},

    {"t": "h2", "num": "13.5", "title": "Threats to validity"},
    {"t": "p", "text":
     "Construct validity is threatened by the fact that the ground truth was authored alongside the detectors. A "
     "rule set tuned on the same defect shapes that the annotations describe will look better than it would on an "
     "independent corpus. The mitigation available within the project is transparency: the ground-truth files are "
     "in the repository, so a reader can see exactly what is being measured and discount accordingly."},
    {"t": "p", "text":
     "External validity is threatened by scale and by language. Ten annotated defects across two small fixtures "
     "cannot support a general claim about repository auditing, and the two fixtures cover only two of the three "
     "parsed languages. Internal validity is threatened by the single-run protocol described above, and by the "
     "dependency of the hybrid arms on provider behaviour that may change between the run and the reading. "
     "Conclusion validity is threatened by the small number of matching decisions: a difference of one finding "
     "moves precision by several percentage points on a corpus of this size, so differences must be large before "
     "they mean anything."},
    {"t": "p", "text":
     "These threats are stated rather than mitigated because the honest position for a prototype is that its "
     "apparatus is sound and its corpus is small. The apparatus is the contribution this report can defend; the "
     "corpus is the first item on the list of future work."},
]

# ====================================================================== CHAPTER 14
CHAPTERS += [
    {"t": "h1", "num": "14", "title": "Results"},
    {"t": "h2", "num": "14.1", "title": "How to read this chapter"},
    {"t": "p", "text":
     "This chapter reports what exists and what does not, in that order. The system's measurable artefacts — code, "
     "routes, tables, tests, fixtures, rules, document set — are reported with exact counts because those counts "
     "are verifiable by opening the repository. The experimental results, which require executing the benchmark "
     "matrix with a configured provider, are reported as pending with explicit TBD markers because they have not "
     "been executed. There is no third category. No value in this chapter is estimated, interpolated or "
     "extrapolated from a related system."},

    {"t": "h2", "num": "14.2", "title": "Artefact measurements"},
    {"t": "table", "caption": "Measured size and composition of the delivered system",
     "source": "Source: Project repository — measured directly from the working tree (files, lines and declarations counted, not estimated).",
     "cols": [42, 22, 36],
     "head": ["Artefact", "Quantity", "How it was counted"],
     "rows": [
         ["Backend application modules", "27,657 lines of Python", "All files under the backend application package."],
         ["Analysis-engine modules", "45 modules, 13,402 lines", "Files in the analysis package, including the package initialiser."],
         ["Database tables", "28 mapped tables", "Table declarations in the model module."],
         ["Migration revisions", "10", "Files in the migration versions directory."],
         ["HTTP route declarations", "112 across 22 routers", "Route decorators across the API route modules."],
         ["Prompt templates", "9 versioned files", "Files in the prompt directory."],
         ["Test functions", "544 in 51 modules", "Test function declarations across the test package."],
         ["Frontend modules", "124 TypeScript files", "Source files under the frontend source tree, excluding configuration."],
         ["Frontend source", "22,580 lines", "TypeScript and TSX source files."],
         ["Interface routes", "40 pages", "Page modules across the three route groups."],
         ["Documentation", "13 documents, 1,660 lines", "Markdown files in the documentation directory, excluding the readme and security notes."],
         ["Benchmark fixtures", "2 repositories, 10 annotated defects", "Fixture directories and their ground-truth files."],
         ["Built-in detection rules", "11 rule identifiers", "Rule declarations in the detector module, including language variants."],
     ]},
    {"t": "p", "text":
     "Two observations follow from the table. The first is that the analysis engine is roughly half the backend by "
     "line count, which is consistent with the project's claim that analysis is the core and the API is a "
     "projection of it. The second is that the test suite is larger, in declarations, than the route surface it "
     "defends, which is unusual for a prototype and is the strongest available evidence that the security and "
     "honesty properties described in earlier chapters are enforced rather than asserted."},

    {"t": "h2", "num": "14.3", "title": "Experimental results"},
    {"t": "p", "text":
     "The benchmark matrix has eight cells: two repositories against four configurations. None of the eight has "
     "been executed for this report, because the model-dependent configurations require a provider key and the "
     "static configuration, while runnable without one, has not been run in this documentation pass. The table "
     "below is the exact form the summary takes when no run exists, which is also the form the repository's own "
     "documentation publishes."},
    {"t": "table", "caption": "Detection and repair comparison across the four configurations",
     "source": "Source: Project repository — docs/experiments.md (expected comparison table). All cells pending experimental execution.",
     "cols": [24, 13, 12, 10, 14, 14, 13],
     "head": ["Configuration", "Precision", "Recall", "F1", "False pos. rate", "Patch correct.", "Verif. success"],
     "rows": [
         ["Static only", "TBD", "TBD", "TBD", "TBD", "Not applicable", "Not applicable"],
         ["Model only", "TBD", "TBD", "TBD", "TBD", "TBD", "TBD"],
         ["Static and model", "TBD", "TBD", "TBD", "TBD", "TBD", "TBD"],
         ["RepoVeriX (full)", "TBD", "TBD", "TBD", "TBD", "TBD", "TBD"],
     ]},
    {"t": "p", "text":
     "The static-only row records patch correctness and verification success as not applicable rather than TBD "
     "because that configuration produces detection output only; it does not generate or verify repairs. This is "
     "a meaningful distinction: not applicable is a statement about the design, whereas TBD is a statement about "
     "missing data, and a results table that conflates them misleads the reader about what remains to be done."},
    {"t": "p", "text":
     "For completeness, the qualitative expectation the project records — and which this report reproduces as an "
     "expectation rather than a result — is that the full configuration should improve precision over the static "
     "configuration by rejecting ungrounded candidates, and should improve repair trust over an unverified repair "
     "pipeline by refusing patches that do not survive execution. Whether those expectations hold, and by how "
     "much, is precisely what the eight unexecuted cells would show."},

    {"t": "h2", "num": "14.4", "title": "Results that are qualitatively demonstrable"},
    {"t": "p", "text":
     "Three properties can be demonstrated from the repository without running the benchmark, and each is worth "
     "separating from the pending quantitative work. First, graceful degradation is observable in code and in the "
     "scan summary schema: the reasoning stage records `llm_unconfigured` when no key is present, and the "
     "deterministic findings still complete. Second, the evidence chain is a persisted artefact rather than a "
     "rendered sentence — it is a table with an ordering index, populated by the adjudicator, and a reviewer can "
     "query it directly. Third, the verification engine's refusal to declare success on tests alone is visible in "
     "the outcome vocabulary: the re-analysis flag is part of the recorded run, and a run where the rule still "
     "fires cannot produce a verified repair."},
    {"t": "table", "caption": "Qualitative properties and the mechanism that makes each demonstrable",
     "source": "Source: Project repository — schema, module interfaces and documentation.",
     "cols": [30, 40, 30],
     "head": ["Property", "Mechanism", "Where to verify"],
     "rows": [
         ["Degradation is recorded, not hidden", "Per-stage analysis rows with status and output payloads.", "Scan detail response and its analysis-run records."],
         ["Evidence is addressable data", "Ordered evidence rows with kind, location and metadata.", "Evidence table and the finding detail response."],
         ["Tests alone cannot verify a repair", "Re-analysis of the original rule is a separate, recorded condition.", "Verification run fields and the outcome vocabulary."],
         ["No metric is fabricated", "Undefined ratios propagate as null and render as TBD.", "Metric module and the summary renderer."],
         ["Original repositories are never mutated", "Repairs are diffs; verification works on a copy that is deleted afterwards.", "Verification module and the storage layout."],
         ["Untrusted content stays data", "Fixed system prompt, delimited data sections, redaction before transmission.", "Prompt templates and the redaction module."],
     ]},

    {"t": "h2", "num": "14.5", "title": "Discussion"},
    {"t": "p", "text":
     "The pattern that emerges from the artefact measurements is that this project spent its effort on the parts "
     "of an auditing system that are usually skipped. Detection rules are comparatively cheap to write; the "
     "expensive parts are the adjudication that decides what a rule's firing means, the verification that decides "
     "whether a repair is real, and the bookkeeping that keeps an honest record when a stage cannot run. The "
     "repository's proportions reflect that priority, and the evaluation apparatus — eight cells, one fresh "
     "database each, ground truth per defect — is the natural counterpart: a system that insists on evidence for "
     "its findings also needs evidence for its own performance claims."},
    {"t": "p", "text":
     "The limitation of this chapter is therefore not a shortfall of the system but a limit of the documentation "
     "pass. The benchmark exists, the fixtures are annotated, the metrics are implemented and the reporting is "
     "wired; what is missing is a configured provider and a quiet hour. The correct response to that situation is "
     "to publish the table with TBD in every cell and say so plainly, which is what the repository already does "
     "and what this chapter has reproduced."},

    {"t": "h2", "num": "14.6", "title": "Reproduction procedure"},
    {"t": "p", "text":
     "For a reader who wishes to convert the pending cells into measured ones, the procedure is documented in the "
     "repository and involves no modification to the code. The backend environment is installed from the "
     "packaging metadata, a provider key is placed in the environment file, the experiment list is enumerated to "
     "confirm which repositories and configurations the runner sees, and the run command is issued against the "
     "experiment configuration with the reports directory as output. The runner writes one artifact per cell and "
     "a summary document. The summary document is the table in this chapter with the TBD cells replaced by "
     "computed values."},
    {"t": "p", "text":
     "Two cautions belong with that procedure and are recorded in the repository's own documentation. A run "
     "without a provider key will complete the static arm and record the model arms as failed rather than "
     "producing numbers, which is the intended behaviour and not a bug. A single run per cell is a demonstration "
     "rather than an estimate, so a defensible result requires several repetitions per cell and a reported "
     "distribution, as noted in the threats to validity."},
]

# ====================================================================== CHAPTER 15
CHAPTERS += [
    {"t": "h1", "num": "15", "title": "Limitations"},
    {"t": "h2", "num": "15.1", "title": "Functional limitations"},
    {"t": "p", "text":
     "The system analyses three languages. A repository written in Java, Go, Rust or C# will be ingested, "
     "inventoried and subjected to the dependency and history analyses, but it will not be parsed into symbols, so "
     "no structural rule will fire and no repair will be generated. This is a hard boundary rather than a "
     "degradation: the discovery manifest will show the languages it detected, and the absence of findings on an "
     "unsupported repository is not evidence that the repository is clean. The interface and the report both "
     "make this distinction visible, but a reader who scans quickly can still draw the wrong conclusion, and that "
     "is a limitation of the presentation as much as of the engine."},
    {"t": "p", "text":
     "Detection is rule-bound. The eleven shipped rules cover injection, secrets, command construction, dynamic "
     "evaluation, weak hashing and error swallowing. They do not cover authorisation logic, race conditions, "
     "deserialisation, path handling or business-logic flaws, which are the categories where modern application "
     "defects most often live. The model can propose claims about those categories, and the adjudicator can accept "
     "them if the repository provides grounding, but there is no deterministic rule to anchor the claim, so such "
     "findings are more likely to land at probable than at verified. The system is honest about this through its "
     "status semantics rather than by pretending the coverage is uniform."},

    {"t": "h2", "num": "15.2", "title": "Evidence depth"},
    {"t": "p", "text":
     "The knowledge graph resolves symbols, imports and single-hop call relationships. That is enough to establish "
     "that a function is called by a route handler, which is a substantial improvement over pattern matching "
     "alone. It is not enough to follow a value through three functions, a dictionary, a queue and a template. "
     "Chains that cross such boundaries terminate in partial evidence and the finding is downgraded accordingly. "
     "The consequence is a systematic bias toward shallow, local defects in the verified category and a residual "
     "population of deep defects in the probable category — a bias that any evaluation of this system should "
     "measure rather than assume away."},
    {"t": "p", "text":
     "Counterexample validation mitigates one specific failure, which is a sanitiser sitting between source and "
     "sink. It does not attempt a general proof of safety. A finding that survives adjudication has evidence "
     "supporting it; it does not have a proof that it is exploitable, and the report avoids the word "
     "*confirmed* for exactly that reason."},

    {"t": "h2", "num": "15.3", "title": "Operational limitations"},
    {"t": "p", "text":
     "Scans run in the process that serves the API. A long scan occupies a worker, a restart interrupts running "
     "work, and the recovery mechanism can only mark interrupted jobs rather than resume them. Rate limiting is "
     "held in memory, so the limits are per process. These choices are documented as deliberate for a "
     "single-instance deployment, and the code isolates them behind seams, but they bound the system's usefulness "
     "beyond a small number of concurrent users and they are the reason no throughput claim appears anywhere in "
     "this report."},
    {"t": "p", "text":
     "Verification requires a container runtime. Without one, every verification resolves to not verified, which "
     "is honest but unhelpful; the system's most distinctive capability is therefore unavailable in the simplest "
     "deployment. The deployment documentation describes mounting the daemon socket and warns, in the same "
     "paragraph, that doing so grants control of the daemon and should be confined to a dedicated host. That "
     "warning is a limitation of the architecture, not a documentation defect: running untrusted code safely is "
     "expensive and the project chose to be explicit about the cost."},

    {"t": "h2", "num": "15.4", "title": "Evaluation limitations"},
    {"t": "p", "text":
     "The benchmark corpus is two small fixtures with ten annotated defects. Every metric in the pending table is "
     "a ratio over that corpus, which means a single matching decision can move a percentage by several points. "
     "The ground truth was authored by the same project that authored the detectors, which raises the possibility "
     "of a favourable bias. And the protocol specifies one run per cell, which cannot separate an effect from "
     "provider noise. None of these is hidden; all three are recorded in the repository's experiment documentation "
     "and in Chapter 13 of this report."},
    {"t": "p", "text":
     "A further limitation concerns what the benchmark does not measure. It measures whether findings match "
     "annotated defects; it does not measure whether a reviewer's time was saved, whether a finding was "
     "actionable, or whether the evidence chain was comprehensible. Those are the questions that determine whether "
     "a tool of this kind is adopted, and they require a user study rather than a corpus."},

    {"t": "h2", "num": "15.5", "title": "Limitations of this report"},
    {"t": "p", "text":
     "This document was written from a repository checkout without executing the application, the test suite or "
     "the benchmark. Statements about implemented behaviour therefore rest on source and documentation rather "
     "than on observed execution, and are labelled accordingly. No screenshot was fabricated: the figures in this "
     "report are conceptual diagrams generated from verified repository facts, and the report says so in every "
     "caption. A reader who wants observed behaviour should run the documented flows; the repository is "
     "structured to make that straightforward, and Chapter 14.6 gives the procedure for the benchmark."},
]

# ====================================================================== CHAPTER 16
CHAPTERS += [
    {"t": "h1", "num": "16", "title": "Ethical and Security Considerations"},
    {"t": "h2", "num": "16.1", "title": "Handling other people's code"},
    {"t": "p", "text":
     "A system that audits repositories is entrusted with source code that may be confidential, may contain "
     "secrets, and may belong to someone other than the person operating the tool. Three commitments follow, and "
     "all three are implemented rather than aspirational. The original repository is never modified: ingestion "
     "produces a working copy, repairs are diffs, and verification operates on a sandbox copy that is deleted "
     "afterwards. Secrets are redacted before content leaves the process, so a provider never receives the "
     "credential that a finding is about. And execution of untrusted code is confined to a container with resource "
     "limits, no host secrets and no mounts beyond the sandbox directory."},
    {"t": "p", "text":
     "The second commitment deserves emphasis because it is counter-intuitive. The system detects hardcoded "
     "credentials, which means it necessarily reads them. The correct behaviour is to report that a secret exists "
     "at a location, not to transmit its value to a third party. Redaction is therefore applied to every snippet "
     "used in prompt construction, and the share mechanism assembles a sanitised payload that excludes "
     "credentials and internal log detail. Detecting a secret is the finding; exfiltrating it would be an "
     "incident."},

    {"t": "h2", "num": "16.2", "title": "Responsible handling of vulnerabilities"},
    {"t": "p", "text":
     "The tool produces statements about weaknesses in software. Those statements can be wrong in either "
     "direction, and each direction has an ethical dimension. A false positive wastes a maintainer's time and, if "
     "published, can damage a reputation. A false negative creates false reassurance. The design response is the "
     "status vocabulary: verified means repository evidence supports the claim, probable means partial support, "
     "and rejected means insufficient grounding and is not shown as a confirmed vulnerability. Confidence is "
     "labelled as a system score rather than a probability, because an uncalibrated number presented as a "
     "probability is a form of false precision."},
    {"t": "p", "text":
     "Two further practices belong here. Findings are de-duplicated on a stable identifier so that re-running a "
     "scan does not inflate a count, and rejected candidates are counted rather than discarded, so the ratio of "
     "rejection is visible to the reviewer. Both are small decisions that make the output harder to misrepresent, "
     "which is the ethical property that matters for a tool of this kind."},

    {"t": "h2", "num": "16.3", "title": "Website auditing ethics"},
    {"t": "p", "text":
     "The website subsystem is bound by a stricter rule than the repository subsystem because its target is "
     "someone else's server. It reads only what any visitor could read: same-origin pages, public response "
     "headers, robots.txt, and the HTML the server chooses to send. It never authenticates, never fuzzes, never "
     "sends destructive requests, and never follows a link off the registered hostname. It honours robots.txt, "
     "waits between requests, caps the crawl at twenty-five pages and three levels of depth, and refuses to run "
     "two audits against the same site concurrently. The politeness delay and the page cap exist for the target's "
     "sake, not for the auditor's."},
    {"t": "p", "text":
     "The output is constrained in the same spirit. Scores are labelled as the project's own analytical scores; "
     "the performance dimension explicitly is not a Lighthouse run and produces no Core Web Vitals; the "
     "accessibility checks are automated DOM checks rather than a conformance audit; and a high score is not a "
     "security certification. Where evidence is insufficient, the score is null and the finding carries an "
     "insufficient state. A tool that told a client their site had an eighty-three out of a hundred and left it "
     "at that would be making an implicit claim about a third party's ranking methodology; this one refuses to."},

    {"t": "h2", "num": "16.4", "title": "Privacy and data protection"},
    {"t": "p", "text":
     "The account model stores a hashed password, never the password itself, and stores personal API tokens only "
     "as a hash, with the plaintext shown once at creation. Authentication events are recorded in an audit trail "
     "for security review. Accounts support export and deletion of the caller's own data, and deletion cascades "
     "through repositories, scans, findings, evidence, patches and verification runs so that removing an account "
     "removes the derived artefacts rather than orphaning them. Email verification is required before repository "
     "registration and scanning, which prevents an unverified address from being used to consume compute."},
    {"t": "p", "text":
     "Two operator obligations sit outside the code and are recorded in the setup documentation. The credentials "
     "in the environment file are secrets and must not be committed; the repository ships only a template with "
     "placeholders. And the deployment must not mount the container daemon socket on a shared host, because that "
     "mount is equivalent to granting control of the daemon."},

    {"t": "h2", "num": "16.5", "title": "Academic integrity and honest reporting"},
    {"t": "p", "text":
     "This report was produced from a repository checkout. Where the repository supplied a fact — a route, a "
     "table, a limit, a rule identifier — the report states it and names the file it came from. Where a number "
     "required an experiment that was not run, the report writes TBD. Where a behaviour exists only in "
     "documentation because it depends on an external service, the report marks it documented and excludes it "
     "from results. Nowhere does the report claim that the test suite passed, because it was not executed during "
     "this pass; nowhere does it present an estimate as a measurement."},
    {"t": "p", "text":
     "Integrity also applies to the figures. Every diagram in this report was generated from verified repository "
     "facts — module inventory, route counts, documented stage order, model definitions — and every caption "
     "records that provenance. No screenshot was fabricated, no interface was mocked up, and no stock imagery was "
     "used. A reader can therefore treat the figures as claims of the same kind as the text: checkable against "
     "the repository they describe."},

    {"t": "h2", "num": "16.6", "title": "Research ethics of the benchmark"},
    {"t": "p", "text":
     "The benchmark fixtures are deliberately vulnerable programs. Their credentials are fake, their defects are "
     "annotated, and the documentation states in the readme, in the fixture readme and in the experiment "
     "documentation that they must never be deployed. This is the standard precaution for a vulnerability corpus, "
     "and it is repeated rather than assumed because a fixture that escapes into a deployment is a real "
     "vulnerability with a public repository attached to it."},
    {"t": "p", "text":
     "The second ethical question is whether publishing a benchmark tuned to one's own detectors constitutes a "
     "claim of general performance. It does not, provided the corpus is described honestly, and the repository's "
     "experiment documentation does exactly that: it states the size, the languages, the defect families and the "
     "fact that metrics are computed only from real runs. This report reproduces that description in Chapter 13 "
     "and repeats the threats to validity in Chapter 15 rather than leaving them for a reader to infer."},
]

# ====================================================================== CHAPTER 17
CHAPTERS += [
    {"t": "h1", "num": "17", "title": "Deployment and Maintenance"},
    {"t": "h2", "num": "17.1", "title": "Topology"},
    {"t": "p", "text":
     "The repository documents two deployment shapes. The simple one is a single compose stack of three services — "
     "a frontend, an API and a PostgreSQL database — with a local volume for repository storage and an optional "
     "container daemon mount for verification. It is intended for evaluation and for a single-operator host. The "
     "recommended production shape separates the concerns: the frontend on a managed static-edge host linked to "
     "the main branch, the API on a small virtual server pulling a published image, the database on a managed "
     "service with a pooled endpoint, and artifact storage on an S3-compatible store when more than one API "
     "instance is required."},
    {"t": "figure", "path": f"{FIG}/fig13_deployment.png", "width": 0.95,
     "caption": "Deployment topology: hosting, API, database, verification runtime and supporting services",
     "source": "Source: Project repository — docs/DEPLOY.md, docker-compose.vps.yml, render.yaml, railway.json."},

    {"t": "h2", "num": "17.2", "title": "Build, publish and release"},
    {"t": "p", "text":
     "Continuous integration runs two jobs on every push and pull request. The backend job installs the package "
     "with development extras, checks formatting, lints, runs the test suite and performs a dependency "
     "vulnerability audit whose failures are surfaced but do not block the build. The frontend job installs from "
     "the lockfile, lints, type-checks, runs its unit tests and produces a production build. A successful push to "
     "the main branch additionally builds multi-architecture images for both services and publishes them to the "
     "container registry, so a server pulls a tested artefact rather than building on the host."},
    {"t": "table", "caption": "Deployment artefacts in the repository",
     "source": "Source: Project repository — Dockerfile, backend/Dockerfile, frontend/Dockerfile, compose files, deployment guides.",
     "cols": [30, 70],
     "head": ["Artefact", "Purpose"],
     "rows": [
         ["Root Dockerfile and per-service Dockerfiles", "Reproducible images for the API and the frontend, multi-architecture for both common server platforms."],
         ["docker-compose.yml", "Local development stack for the three services."],
         ["docker-compose.prod.yml", "Production-oriented stack with migration on start and a health check."],
         ["docker-compose.vps.yml", "Single virtual-server variant that pulls published images and terminates TLS through a bundled reverse proxy."],
         ["Caddyfile and nginx configuration", "Reverse proxy and static serving rules."],
         ["render.yaml and railway.json", "Blueprint manifests for two alternative hosting platforms."],
         ["Environment templates", "Placeholders for every variable, with production-specific guidance in a second template."],
         ["Operator scripts", "Provisioning, backup verification, dependency security check, incident triage, monitoring and release preparation."],
     ]},

    {"t": "h2", "num": "17.3", "title": "Configuration"},
    {"t": "p", "text":
     "All backend settings are environment variables behind a single prefix, read through one settings object, "
     "with defaults chosen so that a development environment starts without configuration. The variables group "
     "into database and storage, execution limits, model access, authentication and account security, email, rate "
     "limiting, billing, artifact storage and observability. Two properties of the design make this manageable: "
     "every limit mentioned in this report corresponds to a named setting rather than a scattered constant, and "
     "the repository ships a classification of each production variable as public or secret in the production "
     "template."},
    {"t": "table", "caption": "Representative configuration settings and their defaults",
     "source": "Source: Project repository — backend/app/core/config.py and .env.example.",
     "cols": [30, 26, 44],
     "head": ["Setting", "Default", "Effect"],
     "rows": [
         ["Repository size cap", "100 MB", "Upper bound on an ingested repository; exceeding it fails the ingestion stage with a readable error."],
         ["Per-file size cap", "1 MB", "Bounds a single source file that the parser will read."],
         ["File count cap", "5,000", "Bounds the number of files extracted from an archive."],
         ["Symbol count cap", "20,000", "Bounds the symbol index; exceeding it degrades gracefully."],
         ["Sandbox CPU limit", "1.0", "CPU shares granted to a verification container."],
         ["Sandbox memory limit", "1 GB", "Memory ceiling for a verification container."],
         ["Sandbox timeout", "600 s", "Wall-clock ceiling for a verification run."],
         ["Sandbox network", "bridge", "Container networking; can be set to none for a fully offline verification."],
         ["Model candidates per scan", "60", "Upper bound on candidates sent for reasoning, which bounds cost."],
         ["Model context characters", "24,000", "Upper bound on the assembled context package per candidate."],
         ["Authentication attempts", "8 per 5 min", "Rate-limit budget for sign-in and sign-up, keyed by client and account."],
         ["Authentication backoff", "30 s to 1 h", "Progressive delay after repeated refusals, doubling to a ceiling."],
         ["User API budget", "600 per min", "Rate-limit budget for an authenticated caller."],
         ["Crawl page cap", "25", "Maximum pages in a website audit, with a default of ten."],
     ]},

    {"t": "h2", "num": "17.4", "title": "Operations and maintenance"},
    {"t": "p", "text":
     "The repository treats operations as a first-class concern rather than an appendix. Seven operator scripts "
     "cover database backup, backup and point-in-time recovery verification, dependency security checking, "
     "incident triage, monitoring and alerting configuration, an operations cadence review and release "
     "preparation. An operational-defect issue template captures the information needed to triage an incident, and "
     "a scheduled workflow runs the operations cadence so that the review happens whether or not anyone remembers "
     "it. Startup recovery marks jobs that a process death left in a running state, so the interface never shows a "
     "job that will not complete."},
    {"t": "p", "text":
     "Maintenance of the analysis engine itself has three predictable dimensions. Rules age: a hash primitive or "
     "an API shape that is acceptable today may not be tomorrow, so the rule catalogue and its documentation must "
     "be revised together. Prompts age faster, because provider models change under a fixed prompt; this is why "
     "prompt files are versioned and why the version is recorded on every scan, so a change in output can be "
     "attributed to a change in configuration rather than to a change in behaviour. And languages age, in the "
     "sense that a new grammar version changes node types; the parser abstraction confines that cost to the "
     "language mapping."},
    {"t": "p", "text":
     "Backups deserve a specific note because the system stores more than rows. Repository storage holds uploaded "
     "archives and extracted working copies, and a database restore without the corresponding storage directory "
     "produces scans whose files cannot be re-read. The backup script and the recovery verification script exist "
     "together for that reason, and the deployment guide states that both stores must be captured."},

    {"t": "h2", "num": "17.5", "title": "Scaling path"},
    {"t": "p", "text":
     "The documented path from single instance to a small cluster follows the seams described in Chapter 7 rather "
     "than requiring a rewrite. Move artifact storage to the S3-compatible adapter, which is already implemented "
     "and fails closed if credentials are missing rather than silently falling back to local disk. Replace the "
     "in-process scheduler with a durable queue behind the existing interface. Replace the in-memory rate limiter "
     "with a shared backend exposing the same three operations. Then run more than one API worker. Each step is a "
     "substitution of an implementation rather than a change of architecture, which is the practical benefit the "
     "monolith's seams were designed to provide."},
]

# ====================================================================== CHAPTER 18
CHAPTERS += [
    {"t": "h1", "num": "18", "title": "Future Enhancements"},
    {"t": "h2", "num": "18.1", "title": "Recorded direction"},
    {"t": "p", "text":
     "The repository lists its intended direction in the readme, and this chapter expands that list rather than "
     "inventing a different one. Each item is stated with the reason it matters and the part of the current design "
     "it would change, so that a reader can judge feasibility rather than take a wish list on trust."},
    {"t": "p", "text":
     "**Pull-request gating and continuous-integration integration.** The system already audits a change set: it "
     "computes a diff for a base and head reference, scores the blast radius, checks for missing companion changes "
     "and can post a summary to a pull request. What is missing is the enforcement path — a status check that "
     "fails a build when a verified-repair-pending finding is introduced, and a policy layer that decides which "
     "rules are blocking. This is the highest-value next step because it moves the audit from on-demand to "
     "continuous, which is where developers actually encounter it."},
    {"t": "p", "text":
     "**An editor extension or model-context-protocol server.** The API is already a complete description of the "
     "capabilities, and a token model exists for headless access. A thin client inside the editor would let a "
     "developer see the evidence chain next to the code, which is the natural place for it. The risk is latency: "
     "an audit is not an editor-time operation, so the useful design is to surface existing findings and request "
     "a scan, not to scan on every keystroke."},
    {"t": "p", "text":
     "**Additional languages.** The parser abstraction makes a language an addition of a grammar and a node "
     "mapping, and the rule set already carries language variants for two of the three supported languages. Java, "
     "Go and C# would each require node mappings, a set of rule variants and a repair template for the "
     "parameterised-query case. The dependency and history analyses would work unchanged because they do not "
     "depend on the parser."},

    {"t": "h2", "num": "18.2", "title": "Deepening the evidence"},
    {"t": "p", "text":
     "**Inter-procedural data flow.** The most valuable single improvement to the system's precision would be "
     "propagating taint across function boundaries with summary-based analysis: for each function, compute which "
     "parameters reach which sinks, then compose summaries along the call graph. The knowledge graph already "
     "provides the edges. The work is in the summaries, the treatment of containers and fields, and the handling "
     "of dynamic dispatch — and the payoff is that deep defects currently downgraded to probable would become "
     "verifiable."},
    {"t": "p", "text":
     "**Semantic retrieval over the repository.** Context assembly currently uses graph proximity: the enclosing "
     "function, its callers and callees, its imports. Embedding-based retrieval would add a different signal — "
     "other functions in the repository that address the same concern — and could improve the model's judgement "
     "on defects that are not visible in a single call chain, such as a validation convention honoured in nine "
     "handlers and violated in a tenth. The cost is an index that must be maintained and a retrieval quality "
     "problem that is itself an object of study."},
    {"t": "p", "text":
     "**Vulnerability-database correlation.** Dependency inventory already records ecosystem, name, version and "
     "development flag. Correlating those with published advisories would extend the audit from code to supply "
     "chain, and the reachability analysis already answers the question that makes such correlation actionable: "
     "does this repository actually import the vulnerable package, or does it merely declare it?"},

    {"t": "h2", "num": "18.3", "title": "Scaling the evaluation"},
    {"t": "p", "text":
     "**A broader benchmark.** The apparatus is complete and the corpus is small. The most defensible next step "
     "for the research claim is to add repositories: real open-source projects with published defects, synthetic "
     "repositories seeded with defect families the current fixtures do not cover, and at least one repository per "
     "supported language. The ground-truth schema already supports this, and the runner takes repositories from "
     "the experiment configuration rather than from a hardcoded list."},
    {"t": "p", "text":
     "**Repeated runs and statistical reporting.** A single run per cell cannot separate an effect from provider "
     "noise. Repeating each cell and reporting a distribution, with the provider identity and version recorded per "
     "run, would turn the comparison table from a demonstration into evidence. The reproducibility block already "
     "captures what is needed to attribute a difference to a configuration change."},
    {"t": "p", "text":
     "**A user study.** The questions that determine adoption are not answered by precision and recall. Does the "
     "evidence chain let a reviewer reach a decision faster than a scanner list? Do reviewers trust a verified "
     "repair more than an unverified diff, and should they? Does the rejected-candidate count change how a "
     "reviewer reads the verified ones? These are empirical questions about comprehension, and they need "
     "practitioners rather than a corpus."},

    {"t": "h2", "num": "18.4", "title": "Engineering maturity"},
    {"t": "p", "text":
     "**A durable job queue.** Replacing the in-process scheduler with a queue would make scans survive a "
     "restart, allow more than one worker, and let long verification runs be retried with backoff. The interface "
     "behind which this change happens already exists, which is why the item appears under engineering maturity "
     "rather than under re-architecture."},
    {"t": "p", "text":
     "**Deeper verification oracles.** Verification currently consults three oracles: the project's tests, a "
     "static baseline and a re-analysis. Two additions would strengthen it. Differential testing, where the "
     "patched and unpatched versions are exercised on generated inputs and their observable behaviour compared, "
     "would catch behaviour changes that the test suite does not cover. And a mutation-style check, where the "
     "original defect is reintroduced to confirm that the tests would have caught it, would tell a reviewer "
     "whether a passing verdict is meaningful — a particularly valuable signal for repositories with thin test "
     "suites."},
    {"t": "p", "text":
     "**Team collaboration and continuous monitoring.** Organisations, membership roles and shared reports exist; "
     "what does not exist is a scheduled re-audit with change notification, and a triage workflow with assignment "
     "and state. Both are ordinary product work rather than research, and both depend on the queue above."},
    {"t": "table", "caption": "Future work, prioritised by dependency and value",
     "source": "Source: Project repository — README future-work section, expanded by the author.",
     "cols": [28, 18, 22, 32],
     "head": ["Enhancement", "Depends on", "Effort", "Value"],
     "rows": [
         ["Pull-request gating in continuous integration", "Existing change-audit and pull-request modules", "Moderate", "Moves auditing from on-demand to continuous; highest adoption impact."],
         ["Durable job queue", "Existing scheduler seam", "Moderate", "Enables multiple workers, restart survival and retries."],
         ["Broader benchmark corpus and repeated runs", "Existing runner and ground-truth schema", "Low to moderate", "Converts the pending comparison into defensible evidence."],
         ["Inter-procedural data flow", "Knowledge graph and evidence model", "High", "Moves deep defects from probable to verified."],
         ["Additional languages", "Parser abstraction and rule variants", "Moderate per language", "Broadens applicability beyond three languages."],
         ["Semantic retrieval for context", "New index and evaluation", "High", "Improves judgement on repository-wide conventions."],
         ["Differential and mutation oracles", "Sandbox runner", "Moderate", "Makes a verified verdict meaningful on thin test suites."],
         ["Editor or agent-protocol integration", "Token-authenticated API", "Moderate", "Puts evidence next to the code."],
     ]},
]

# ====================================================================== CHAPTER 19
CHAPTERS += [
    {"t": "h1", "num": "19", "title": "Conclusion"},
    {"t": "p", "text":
     "This report has documented RepoVeriX, a research prototype for repository-level code auditing and verified "
     "automated repair, from its problem statement through its architecture, data model, interface, testing, "
     "evaluation design and deployment. The system's contribution is best stated as a discipline rather than a "
     "feature. It insists that a claim about a defect be accompanied by repository evidence, that a claim about a "
     "repair be accompanied by the execution that established it, and that a stage which could not run be recorded "
     "as such rather than papered over with a plausible number. Those three commitments shape almost every design "
     "decision described in these chapters, from the ordering of the evidence chain to the vocabulary of "
     "verification outcomes to the decision to render an undefined ratio as TBD."},
    {"t": "h2", "num": "19.1", "title": "What was built"},
    {"t": "p", "text":
     "The delivered artefact is a complete three-part application. A FastAPI backend of roughly twenty-eight "
     "thousand lines implements ingestion, parsing, structural analysis, deterministic detection, context "
     "assembly, model interaction, evidence adjudication, repair generation and sandboxed verification, and "
     "exposes them through one hundred and twelve route declarations across twenty-two routers. A PostgreSQL "
     "schema of twenty-eight tables persists the audit spine and the surrounding capability surface, with ten "
     "migration revisions and SQLite support for development. A Next.js interface of forty routes and roughly "
     "twenty-two and a half thousand lines presents findings as case files rather than alerts, with the evidence "
     "chain and the verification log visible in place. A benchmark harness with two annotated fixtures and four "
     "configurations completes the apparatus, and five hundred and forty-four test functions defend the "
     "behaviours the system relies on."},
    {"t": "p", "text":
     "The analysis engine is the centre of gravity at forty-five modules and thirteen and a half thousand lines, "
     "and within it the evidence model and the verification engine are the parts that distinguish the project. "
     "The evidence model converts a candidate into an adjudicated finding with an ordered chain of typed nodes, "
     "asserting the minimum required evidence in code so that a model's assertion can never be sufficient. The "
     "verification engine converts a candidate patch into a verdict by applying it to a disposable copy, "
     "comparing a static baseline, running the project's tests in a resource-limited container and re-analysing "
     "the original finding — and by refusing to declare success when the rule still fires, even if every test "
     "passes."},

    {"t": "h2", "num": "19.2", "title": "What was demonstrated"},
    {"t": "p", "text":
     "Six properties are demonstrable from the repository itself and have been documented in the preceding "
     "chapters with their mechanism. Repository content never executes on the host during analysis. Secrets are "
     "redacted before content reaches a model provider. A scan records every stage, including the stages that "
     "failed and why. A finding carries an ordered evidence chain that a reviewer can inspect node by node. A "
     "repair is verified by execution or reported as not verified, never assumed. And no metric is fabricated: "
     "undefined quantities propagate as null and appear as TBD."},
    {"t": "p", "text":
     "Six corresponding limits have been stated with equal precision. Three languages are parsed and no more. "
     "Evidence depth is single-hop, so deep defects are downgraded. Scans run in-process, so throughput is "
     "bounded. Verification needs a container runtime and is unavailable without one. The benchmark corpus is "
     "small and was authored alongside the detectors. And the quantitative comparison across the four "
     "configurations has not been executed, so every cell in the results table reads TBD. The report has "
     "resisted the temptation to fill those cells with an expectation dressed as a measurement, because a "
     "document arguing for evidence-grounded claims cannot itself rely on unevidenced ones."},

    {"t": "h2", "num": "19.3", "title": "What the work suggests"},
    {"t": "p", "text":
     "Three observations seem worth carrying beyond this project. The first is that the interesting engineering "
     "in an AI-assisted security tool is not the model call but the adjudication around it. A prompt is a few "
     "dozen lines; the evidence model that decides what a prompt's output is permitted to mean is where the "
     "reliability of the system actually lives. The second is that honesty is an architectural property, not a "
     "tone of voice. Recording a failed stage, counting rejected candidates, returning an undefined ratio and "
     "distinguishing *cannot determine* from *failed* are all schema and control-flow decisions; a system that "
     "makes them cannot easily lie about itself afterwards. The third is that a repair oracle needs more than "
     "tests. The re-analysis step exists because the repositories most in need of repair are precisely the ones "
     "whose tests never covered the defect, and any verification design that ignores this is verifying the test "
     "suite rather than the fix."},

    {"t": "h2", "num": "19.4", "title": "Concluding remarks"},
    {"t": "p", "text":
     "RepoVeriX is, finally, an argument made in software: that a tool may be permitted to be uncertain but not "
     "to be vague, and that the difference between the two is a matter of design. The system is honest about what "
     "it has established and about what it has not, and it is built so that a reviewer can check the first claim "
     "and see the second. The next steps are clear and none of them require rethinking the architecture: run the "
     "benchmark, broaden the corpus, deepen the data flow, and take the audit to the pull request where "
     "developers already are. The apparatus for measuring those improvements is already in the repository, which "
     "is the most useful thing a prototype can leave behind."},
]

# ====================================================================== REFERENCES
REFERENCES = [
    {"t": "h1", "num": "", "title": "References"},
    {"t": "p", "text":
     "References are divided into the repository's own primary sources and the external works that inform the "
     "concepts used in this report. Primary sources are cited by path within the project, following the convention "
     "used throughout the document."},
    {"t": "h2", "num": "A", "title": "Primary sources from the project repository"},
    {"t": "refs", "items": [
        "RepoVeriX. *README.md* — project statement, feature list, architecture summary, research questions, limitations and future work. Repository root.",
        "RepoVeriX. *docs/architecture.md* — modular monolith rationale, layer and module inventory, experimental configurations, key guarantees.",
        "RepoVeriX. *docs/analysis-pipeline.md* — stage-by-stage pipeline description, failure handling and reproducibility metadata.",
        "RepoVeriX. *docs/evidence-model.md* — evidence kinds, candidate-to-finding flow, status semantics.",
        "RepoVeriX. *docs/verification.md* — verification workflow, outcome vocabulary, sandbox security and API surface.",
        "RepoVeriX. *docs/security.md* — threat model for archives, repository code, prompts, environment and resources.",
        "RepoVeriX. *SECURITY.md* — hardening notes covering rate limiting, input validation and operational controls.",
        "RepoVeriX. *docs/database.md* — entity relationship description and table-by-table column notes.",
        "RepoVeriX. *docs/api.md* — endpoint reference, status vocabulary and interface conventions.",
        "RepoVeriX. *docs/experiments.md* — research questions, benchmark framework, metric definitions and current status.",
        "RepoVeriX. *docs/website-audits.md* — passive crawl safety model, measured dimensions, scoring honesty and data model.",
        "RepoVeriX. *docs/development.md* — local setup, test commands, end-to-end demonstration script and model configuration.",
        "RepoVeriX. *docs/DEPLOY.md*, *docs/DEPLOYMENT_GUIDE.md*, *docs/MANUAL-SETUP.md* — deployment topology, operator checklist and environment reference.",
        "RepoVeriX. *backend/app/analysis/* — analysis engine modules (45 modules, 13,402 lines), including ingestion, parsing, knowledge, detectors, context, redaction, llm, evidence, validation, repair, patch operations, verification and orchestration.",
        "RepoVeriX. *backend/app/db/models.py* — 28 mapped tables, enumerations and relationship definitions.",
        "RepoVeriX. *backend/app/api/routes/* — 22 routers containing 112 route declarations.",
        "RepoVeriX. *backend/prompts/* — nine versioned prompt templates.",
        "RepoVeriX. *backend/tests/* — 51 test modules containing 544 test functions, plus seeded fixture repositories.",
        "RepoVeriX. *bench/configs/experiments.json*, *bench/ground_truth/*, *bench/reports/README.md* — benchmark configuration, annotated ground truth and reporting rules.",
        "RepoVeriX. *frontend/src/* — Next.js application (124 TypeScript modules, 22,580 lines, 40 page routes).",
        "RepoVeriX. *Dockerfile*, *backend/Dockerfile*, *frontend/Dockerfile*, *docker-compose*.yml, *Caddyfile*, *render.yaml*, *railway.json* — build and deployment artefacts.",
        "RepoVeriX. *.github/workflows/* — continuous integration, deployment and operations-cadence workflows.",
        "RepoVeriX. *RepoVeriX-Presentation.pptx* — project presentation deck (reviewed; the report's figures were generated from repository facts rather than from the deck).",
    ]},
    {"t": "h2", "num": "B", "title": "External and conceptual sources"},
    {"t": "p", "text":
     "The works below inform the concepts used in this report. They are cited in the text by family rather than by "
     "individual entry, because the report distinguishes approaches rather than attributing specific mechanisms to "
     "specific papers; a reader who wants the primary literature will find it by way of these pointers, and the "
     "project repository's own documentation lists the systems it was positioned against when the work began."},
    {"t": "refs", "items": [
        "OWASP Foundation. *OWASP Top Ten* — the standard reference for web application security risk categories referred to in Chapter 4.",
        "OWASP Foundation. *OWASP Application Security Verification Standard* — used conceptually for the authentication, session and authorisation expectations discussed in Chapters 7 and 16.",
        "NIST. *Secure Software Development Framework, SP 800-218* — framing for the supply-chain and dependency considerations in Chapter 18.",
        "OASIS. *Static Analysis Results Interchange Format (SARIF) 2.1.0* — the interchange format used for findings export.",
        "Chen, Z. et al. *A LLM-based approach to automated code review* and related empirical studies of model-based code review — background for the model-based review family in Chapter 4.",
        "RepoAudit-style repository-level code QA research — the family of systems that analyse whole repositories rather than single files, discussed in Chapter 4.3.",
        "CodePlan and planning-oriented repository agents — evidence that repository structure improves model reasoning, discussed in Chapter 4.3.",
        "Le Goues, C. et al. *Automated program repair* (survey literature) — the taxonomy of template, search-based and learning-based repair used in Chapter 4.4.",
        "Just, R. et al. *Defects4J* and the broader benchmark tradition in program repair — methodological precedent for the benchmark design in Chapter 13.",
        "Tree-sitter documentation — incremental parsing library used for the structural model in Chapter 7.5.",
        "Framework and platform documentation: FastAPI, SQLAlchemy and PostgreSQL for Chapters 8 and 11; Next.js for Chapter 10; Docker for the resource constraints of the sandbox in Chapter 7.12.",
    ]},
]

# ====================================================================== APPENDICES
CHAPTERS += [
    {"t": "h1", "num": "A", "title": "Appendix A — Rule and Detector Reference"},
    {"t": "p", "text":
     "This appendix consolidates the rule reference used by the detectors, the rule catalogue in the interface and "
     "the benchmark ground truth. Each rule is listed with the defects it addresses, the evidence the engine "
     "attaches, the deterministic repair that exists for it, and the fixture defects that exercise it in the "
     "benchmark."},
    {"t": "table", "caption": "Rule reference, evidence and benchmark coverage",
     "source": "Source: Project repository — backend/app/analysis/detectors.py, frontend/src/lib/rules.ts, bench/ground_truth.",
     "cols": [17, 23, 26, 18, 16],
     "head": ["Rule", "Defect class", "Evidence attached", "Template repair", "Fixture coverage"],
     "rows": [
         ["RVX-SQLI-001", "SQL injection, Python", "Query assembly lines, execution sink, tainted-parameter signal, route-handler signal.", "Parameterised query", "Python fixture, function at line 53."],
         ["RVX-SQLI-JS-001", "SQL injection, JavaScript", "Template-literal assembly and client execution site.", "None (model repair only)", "JavaScript fixture, line 18."],
         ["RVX-SECRET-001", "Hardcoded credential, primary", "Assignment site, credential-shaped literal, module scope.", "Environment indirection", "Python fixture, line 12."],
         ["RVX-SECRET-002", "Hardcoded credential, variant", "Assignment site with provider-shaped prefix.", "Environment indirection", "Not exercised by fixtures."],
         ["RVX-SECRET-JS-001", "Hardcoded secret, JavaScript", "Constant assignment with secret-shaped name.", "None", "JavaScript fixture, line 13."],
         ["RVX-CMDI-001", "Command injection, Python", "Constructed command string and shell invocation.", "Argument-form invocation", "Python fixture, line 72."],
         ["RVX-CMDI-JS-001", "Command injection, JavaScript", "Interpolated command and child-process execution.", "None", "JavaScript fixture, line 24."],
         ["RVX-EVAL-001", "Unsafe evaluation, Python", "Evaluation call with caller-supplied expression.", "Remove dynamic evaluation", "Python fixture, line 79."],
         ["RVX-EVAL-JS-001", "Unsafe evaluation, JavaScript", "Evaluation or function construction from input.", "None", "JavaScript fixture, line 31."],
         ["RVX-CRYPTO-001", "Weak hash", "Hash primitive call used on token material.", "Stronger hash", "Python fixture, line 84."],
         ["RVX-EXCEPT-001", "Broad exception swallowing", "Handler that discards the error.", "Not templated", "Python fixture, line 94."],
     ]},
    {"t": "p", "text":
     "The pattern in the last two columns is deliberate and worth explaining. Templates exist for the five strong "
     "rule families, where the insecure form and its correct replacement are structurally unambiguous. The "
     "JavaScript rules and the exception rule have no template, so a repair for them, if any, comes from the "
     "model and must survive verification like any other patch. The benchmark fixtures exercise nine of the "
     "eleven identifiers, which means two rules are shipped, documented and unit-tested but are not currently "
     "measured by the benchmark — a gap worth closing when the corpus is broadened."},

    {"t": "h1", "num": "B", "title": "Appendix B — Configuration and Environment Reference"},
    {"t": "p", "text":
     "The following table groups the environment variables that an operator is most likely to touch, with the "
     "behaviour each controls. It is a summary of the repository's configuration module and its environment "
     "template rather than a complete transcription; the template in the repository is authoritative and lists "
     "every variable with a comment."},
    {"t": "table", "caption": "Operationally significant configuration groups",
     "source": "Source: Project repository — backend/app/core/config.py, .env.example, .env.prod.example.",
     "cols": [24, 30, 46],
     "head": ["Group", "Representative variables", "Operational significance"],
     "rows": [
         ["Application", "Environment name, API prefix, debug flag, allowed hosts, CORS origins, documentation exposure.", "Determines what the service reveals and which clients may call it; documentation exposure is disabled by default in production."],
         ["Database", "Connection URL, automatic table creation flag.", "Switches between PostgreSQL and SQLite; automatic creation is intended for development and tests."],
         ["Storage", "Repository storage directory, artifact storage backend, S3-compatible credentials and endpoint.", "The S3 adapter fails closed when credentials are missing, which prevents a multi-instance deployment from silently writing to local disk."],
         ["Ingestion limits", "Maximum repository size, file size, file count, symbol count, log characters, clone timeout.", "Bounds the resource an untrusted repository can consume."],
         ["Sandbox", "CPU limit, memory limit, timeout, network mode, process cap.", "The isolation contract for executing untrusted project code."],
         ["Model access", "Provider, model identifier, per-provider keys and base URLs, fallback order, temperature, timeout, retries, candidate cap, context cap.", "Controls cost and availability of the reasoning stage; absent keys degrade the stage rather than the scan."],
         ["Authentication", "JWT secret and algorithm, token lifetime, verification requirement, disposable-address policy, lockout and backoff settings.", "The account-security posture; the secret must be generated per deployment."],
         ["Rate limiting", "Global enable flag, public, user and action budgets, authentication attempts and window, backoff floor and ceiling, proxy-header trust.", "Abuse resistance; proxy-header trust must only be enabled behind a reverse proxy that overwrites the header."],
         ["Email", "Backend selection, SMTP parameters, sender identity, resend and reset hourly caps.", "Determines whether verification and reset mail is delivered or written to the log."],
         ["Billing", "Enforcement flag, provider keys, product identifiers, environment, demo mode, operator addresses.", "Plan gates and operator privileges; demo mode exists for evaluation without a payment provider."],
         ["Website audits", "Crawl limits, quota, request timeout, response size cap.", "Bounds the politeness and cost of a passive crawl."],
         ["Observability", "Log level, metrics exposure, alerting endpoints.", "Operational visibility described in Chapter 17."],
     ]},

    {"t": "h1", "num": "C", "title": "Appendix C — Module, Requirement and Test Matrix"},
    {"t": "p", "text":
     "This appendix is the traceability artefact promised in Chapter 6, expanded to module level. It allows a "
     "reader to move from a requirement to the module that satisfies it and to the test area that defends it."},
    {"t": "table", "caption": "Traceability from requirement to module and test area",
     "source": "Source: Project repository — module inventory, requirements derived in Chapter 6, test modules.",
     "cols": [12, 27, 33, 28],
     "head": ["Requirement", "Primary modules", "Supporting modules", "Test area"],
     "rows": [
         ["FR-01, NFR-07", "auth routes, account security routes, security core", "account security service, auth audit, rate limiter", "Authentication, account security routes, admin access"],
         ["FR-02, NFR-01", "ingest, discovery", "core ssrf (for URL ingestion), process utilities", "Ingestion, security, hardening"],
         ["FR-03, FR-04, NFR-06", "scans routes, orchestrate, runtime", "recovery, metrics, logging", "Scans, orchestrator, recovery"],
         ["FR-05", "parsing", "knowledge", "Parsing, intelligence"],
         ["FR-06, FR-07", "detectors, knowledge, tools", "archsmells, attack paths, dependency reachability", "Detectors, architecture-smell evidence, tier workflows"],
         ["FR-08, FR-09, NFR-03, NFR-04", "context, redaction, llm", "core crypto, middleware", "Model providers, security regression"],
         ["FR-10, NFR-06", "evidence, validation, counterexamples", "regression, risk model, rule selection", "Validation, detectors, tier workflows"],
         ["FR-11, FR-15", "findings routes, reporting, sarif", "impact, finding chat, feedback", "Findings, reporting, SARIF export"],
         ["FR-12, FR-13", "repair, patchops, patchquality", "prooffix, test generation", "Patches, proof-of-fix"],
         ["FR-14, NFR-02", "verify, patchops", "process utilities, proof-of-fix", "Verification, production lifecycle"],
         ["FR-16, NFR-03", "sharing service and routes, feedback routes", "reporting", "Feedback and sharing"],
         ["FR-17, NFR-08", "webcrawler, webanalyze, webrun, website routes", "core ssrf, rate limiter", "Websites and crawl safety"],
         ["FR-18", "organisations routes, access service", "models, dependencies", "Team features, admin access"],
         ["FR-19, NFR-03", "tokens routes, models", "authentication dependencies", "Team features, security"],
         ["FR-20", "benchmark package", "orchestrate", "Benchmark"],
         ["FR-21", "billing service and routes, dodo client", "entitlements", "Billing, billing persistence, entitlements"],
         ["NFR-09, NFR-10", "orchestrate, runtime, recovery", "all analysis modules", "Orchestrator, recovery, hardening"],
         ["NFR-11", "configuration module", "database session, mailer, mock provider", "Development setup exercised by the whole suite"],
         ["NFR-12", "health endpoint, metrics, observability middleware", "operator scripts, cadence workflow", "Production operations, operational cadence"],
     ]},

    {"t": "h1", "num": "D", "title": "Appendix D — Evidence, Reproduction and Figure Provenance"},
    {"t": "h2", "num": "D.1", "title": "Figure provenance"},
    {"t": "p", "text":
     "The report contains no product screenshots and no stock imagery. Every figure is a conceptual diagram "
     "generated for this report from facts verified in the repository: the documented stage order, the module "
     "inventory, the route counts, the table definitions, the deployment manifests and the test inventory. The "
     "generator, its inputs and the counts it produced are retained with the report so that a reader can "
     "regenerate any figure and compare it with the diagram printed here."},
    {"t": "table", "caption": "Figure provenance: what each diagram is based on",
     "source": "Source: author's figure generator and the repository files named in each row.",
     "cols": [10, 42, 48],
     "head": ["Figure", "Diagram", "Verified inputs"],
     "rows": [
         ["1", "Layered architecture", "Architecture document, API route inventory, frontend route tree."],
         ["2", "Scan pipeline", "Pipeline document and orchestrator module stage sequence."],
         ["3", "Evidence chain and adjudication", "Evidence model document and evidence module status rules."],
         ["4", "Four configurations", "Architecture document configuration table."],
         ["5", "Verification workflow", "Verification document and verification module step sequence."],
         ["6", "Entity relationships", "Database document and model definitions."],
         ["7", "Untrusted domain and controls", "Security document threat and control sections."],
         ["8", "Execution isolation", "Verification document and compose files."],
         ["9", "Benchmark harness", "Experiment document, configuration file and README reporting rules."],
         ["10", "Route distribution", "Counted route decorators per router module."],
         ["11", "Module size distribution", "Counted lines per analysis module."],
         ["12", "Interface route map", "Frontend route tree."],
         ["13", "Deployment topology", "Deployment guide, compose files and hosting manifests."],
         ["14", "Test inventory", "Counted test functions per area."],
         ["15", "Repair decision path", "Repair module template rules and generation order."],
     ]},
    {"t": "h2", "num": "D.2", "title": "Reproduction checklist"},
    {"t": "p", "text":
     "A supervisor or examiner who wishes to verify the claims in this report can follow the sequence below. Each "
     "step names the observable outcome that confirms the corresponding claim; nothing in the list requires "
     "writing code."},
    {"t": "numbers", "items": [
        "Install the backend from its packaging metadata into a virtual environment and confirm the installed "
        "version resolves. This confirms the dependency list quoted in Chapter 11.",
        "Start the API with an SQLite connection string and open the health endpoint. This confirms the "
        "portability claim in Chapter 6 and the liveness surface in Chapter 9.",
        "Open the generated documentation surface and count the routers. This confirms the twenty-two-router, "
        "one-hundred-and-twelve-declaration inventory in Chapter 9.",
        "Start the frontend from the lockfile and visit the workspace routes. This confirms the route map in "
        "Chapter 10.",
        "Upload the seeded Python fixture as an archive and start a scan in the static configuration. This "
        "confirms ingestion, parsing, detection and adjudication without any provider dependency.",
        "Inspect a produced finding and read its evidence chain. This confirms the evidence model in Chapter 7.9.",
        "Request a fix for a templated rule, then request verification with a container runtime available. This "
        "confirms the repair and verification workflow in Chapters 7.10 and 7.11.",
        "Register a website whose hostname resolves to a private address and observe the refusal. This confirms "
        "the SSRF control in Chapter 7.13.",
        "Run the benchmark command with a provider key configured and compare the generated summary with the "
        "pending table in Chapter 14. This is the step that converts TBD into measured values.",
        "Run the test suite with the documented command and record the count. This converts the statement in "
        "Chapter 12 from a count of declarations to a count of passing tests.",
    ]},
    {"t": "h2", "num": "D.3", "title": "Known gaps in this report"},
    {"t": "p", "text":
     "For completeness, the following items could not be established from the repository during this documentation "
     "pass and are recorded here so that no reader is left to discover them independently. The test suite was not "
     "executed, so no pass count or coverage figure is reported. The benchmark matrix was not executed, so every "
     "metric cell is TBD. The application was not run, so no screenshot exists and none was fabricated. The "
     "deployment topologies are documented in the repository but were not exercised here. The billing and email "
     "integrations depend on external providers that were not configured. And the historical dataset or "
     "user-study evidence that would support adoption claims does not exist in the repository and is therefore "
     "not claimed."},
    {"t": "p", "text":
     "Each of these gaps is closed by a step in the reproduction checklist above, and each corresponds to a claim "
     "this report deliberately did not make. The report is longer for that discipline rather than shorter, because "
     "explaining what a system establishes — and how a reader may confirm it — is the substance of technical "
     "documentation, not a preface to it."},

    {"t": "closing"},
]
