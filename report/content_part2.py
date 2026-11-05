"""Chapters 5-10 of the RepoVeriX project report."""

from __future__ import annotations

FIG = "../figures"

CHAPTERS: list[dict] = []

# ====================================================================== CHAPTER 5
CHAPTERS += [
    {"t": "h1", "num": "5", "title": "The Proposed System"},
    {"t": "h2", "num": "5.1", "title": "Design principle"},
    {"t": "p", "text":
     "The proposed system is organised around a single sentence that appears at the top of the repository's "
     "readme: *the LLM proposes; evidence and execution verify*. Read as an architecture, the sentence separates "
     "three kinds of actor. Proposers generate candidate claims — a rule fires, a model suggests, a template "
     "recognises a shape. Verifiers decide what may be believed — an evidence adjudicator for claims about "
     "defects, an execution sandbox for claims about repairs. And the storage layer records both the claim and the "
     "verdict, so that the difference between them is never lost."},
    {"t": "p", "text":
     "This separation has a practical consequence that distinguishes the system from a chat interface wrapped "
     "around a scanner. A component is allowed to be wrong, because no component is allowed to be final. A rule can "
     "over-fire; the evidence adjudicator demotes or rejects the result. A model can hallucinate; the adjudicator "
     "refuses to publish the claim. A generated patch can be subtly wrong; the sandbox catches it. The system's "
     "reliability is therefore a property of the composition rather than of any single component, which is also "
     "what makes the composition worth measuring."},

    {"t": "h2", "num": "5.2", "title": "The proposed pipeline"},
    {"t": "p", "text":
     "Six stages carry a repository from bytes on disk to a verified repair. The order is fixed and each stage "
     "persists its own record, so a scan can be audited after the fact."},
    {"t": "table", "caption": "The six pipeline stages and what each persists",
     "source": "Source: Project repository — docs/analysis-pipeline.md and backend/app/analysis/orchestrate.py.",
     "cols": [6, 17, 44, 33],
     "head": ["#", "Stage", "What happens", "Persisted record"],
     "rows": [
         ["1", "Ingestion", "A GitHub URL is shallow-cloned, or an uploaded ZIP is validated by magic bytes, stored and extracted with traversal guards and size caps. A single top-level wrapper folder is unwrapped. The original archive is never modified.",
          "Repository row with source type, storage path and detected primary languages."],
         ["2", "Parsing", "tree-sitter parses each supported file into functions, methods, classes, decorators, imports and call sites. Parse failures are recorded as warnings and never abort the scan.",
          "File and Symbol rows, plus a discovery manifest of languages, package managers, tests and dependencies."],
         ["3", "Static analysis", "Built-in RVX rules run on parsed symbols and source. External tools run only when their binaries are present, and their absence is recorded rather than fatal.",
          "Candidate findings with rule identifiers, severity, sink location and evidence drafts; per-tool run records in the scan summary."],
         ["4", "Knowledge graph", "Files, symbols and calls are indexed so that callers and callees of any candidate can be resolved across files.",
          "In-memory graph consumed by the next stages; caller evidence attached to candidates."],
         ["5", "LLM reasoning", "A bounded, redacted context package is assembled per candidate and sent to the configured provider with a versioned prompt; the structured reply is parsed.",
          "Token usage and estimated cost on the scan, provider and model identity in the reproducibility block."],
         ["6", "Evidence validation", "Candidates are adjudicated into VERIFIED, PROBABLE or REJECTED using deterministic rules; survivors become findings with an ordered evidence chain.",
          "Finding rows with status, confidence, source and severity, and Evidence rows ordered by index."],
     ]},
    {"t": "figure", "path": f"{FIG}/fig02_pipeline.png", "width": 0.95,
     "caption": "Scan pipeline with per-stage persistence and the reproducibility block",
     "source": "Source: Project repository — docs/analysis-pipeline.md, backend/app/analysis/orchestrate.py."},
    {"t": "p", "text":
     "Two properties of this table deserve emphasis because they are unusual in comparable systems. First, every "
     "stage writes an analysis-run row containing its status, the tool used, a structured output payload and "
     "timing. A scan therefore never silently skips work: if the reasoning stage failed because no provider key was "
     "configured, the record says so and the interface shows it. Second, the reproducibility block stored on a "
     "completed scan contains the analyzer version, prompt version, model provider and identifier, versions of "
     "external tools, the repository commit when one is available, and a UTC timestamp. Together these make a scan "
     "a reproducible experiment rather than a transient opinion."},

    {"t": "h2", "num": "5.3", "title": "Four configurations as an experimental design"},
    {"t": "p", "text":
     "The same pipeline supports four configurations, selected per scan. The choice is not a user preference; it "
     "is the independent variable of the project's evaluation."},
    {"t": "figure", "path": f"{FIG}/fig04_configurations.png", "width": 0.95,
     "caption": "The four audit configurations and the stages each one executes",
     "source": "Source: Project repository — docs/architecture.md (configuration table), backend/app/analysis/orchestrate.py."},
    {"t": "p", "text":
     "In the static-only configuration the pipeline parses, analyses and adjudicates on static evidence alone; the "
     "result is a set of findings whose evidence is entirely repository-derived. In the model-only configuration "
     "the whole repository is reviewed by the model and each claim must still survive grounding validation to "
     "become a finding — a deliberate choice, because an unvalidated model-only arm would measure the model rather "
     "than the system. The hybrid configuration asks the model to reason about each static candidate, which is "
     "cheaper and more focused than reviewing the repository. The full configuration adds repository context from "
     "the knowledge graph to that reasoning."},
    {"t": "p", "text":
     "Comparing the four arms answers four research questions that the project states explicitly. Does "
     "repository-level context improve what a model can say about a defect, and if so by how much? Does combining "
     "static evidence with model reasoning beat either alone on precision and recall? Does evidence validation "
     "actually reduce false positives, measured by the number of candidates rejected? Does execution-based "
     "verification improve the proportion of repairs that hold? The benchmark chapter returns to these questions "
     "with the honest answer that the machinery exists and the numbers do not yet."},

    {"t": "h2", "num": "5.4", "title": "What is implemented, designed and planned"},
    {"t": "p", "text":
     "The repository is large enough that a reader could reasonably lose track of what is finished, so three "
     "categories are used throughout the report and are fixed here. **Implemented** covers the capabilities "
     "exercised by the code and the test suite: ingestion from archives and Git URLs under traversal and size "
     "guards, parsing of three languages, the deterministic rule set with stable identifiers, the symbol and call "
     "graph, bounded context assembly with secret redaction, six model providers behind one interface, evidence "
     "adjudication with ordered chains, five deterministic repair templates, sandboxed verification with test "
     "result parsing, the twenty-two-router API with per-object authorisation, the twenty-eight-table schema with "
     "ten migrations, the forty-route developer interface, the benchmark harness with two annotated fixtures, "
     "passive website audits with SSRF defence, and organisations with ranked roles and hashed API tokens."},
    {"t": "p", "text":
     "**Documented** covers capabilities that exist in code but depend on an external service or an operator "
     "action: billing and plan entitlements through a payment provider, authentication mail delivery, OAuth "
     "sign-in and repository import, and the deployment topologies themselves. **Planned** covers what appears "
     "only as future work and must not be read as present: multi-instance operation behind a durable job queue, "
     "additional programming languages, and inter-procedural data-flow analysis beyond the single-hop caller "
     "evidence the graph supports. Chapter 15 states the consequences of the third category, and Chapter 14 "
     "reports results only for the first."},
    {"t": "h2", "num": "5.5", "title": "How the proposed system differs in use"},
    {"t": "p", "text":
     "Because the architecture is unusual, it is worth describing the experience rather than the components. A "
     "reviewer opening a finding sees four things side by side: the location, expressed as file, function and line "
     "range; the status and the severity, with confidence labelled explicitly as a system score rather than a "
     "probability; the ordered evidence chain, each node naming the file and line it came from; and the repair "
     "panel, which offers a generated diff and a verification control. This arrangement is deliberately unlike a "
     "scanner's list of hits. It is closer to a case file: the claim, the exhibits, and the experiment that would "
     "settle the matter."},
    {"t": "p", "text":
     "The verification panel extends the same logic to repair. Requesting verification does not produce an answer; "
     "it starts a run whose log is shown as it proceeds — patch applied, static comparison, test execution, "
     "re-analysis — and whose final state is one of five recorded outcomes. A reviewer who wants to disagree with "
     "the system can therefore disagree with a specific step rather than with a verdict. That is the property this "
     "chapter has been arguing for: the system is designed to make its reasoning inspectable, because a tool that "
     "cannot be argued with cannot be trusted in a security workflow."},
]

# ====================================================================== CHAPTER 6
CHAPTERS += [
    {"t": "h1", "num": "6", "title": "Requirements Analysis"},
    {"t": "h2", "num": "6.1", "title": "Method"},
    {"t": "p", "text":
     "Requirements were derived from three sources rather than invented for this document. The first is the "
     "repository's own documentation, which states the guarantees the system intends to hold — non-mutation of "
     "originals, untrusted content, no fabricated results. The second is the implemented interface: every route, "
     "model field and configuration value implies a requirement that the code already satisfies or fails to "
     "satisfy. The third is the benchmark and test suite, which encode acceptance conditions in executable form. "
     "Each requirement below carries an identifier used later in the testing chapter, and each is marked with the "
     "same Implemented, Documented, Experimental or Planned label used in Chapter 5."},

    {"t": "h2", "num": "6.2", "title": "Functional requirements"},
    {"t": "table", "caption": "Functional requirements",
     "source": "Source: Project repository — API routers, analysis modules, documentation and test suite.",
     "cols": [9, 55, 22, 14],
     "head": ["ID", "Requirement", "Verified by", "Status"],
     "rows": [
         ["FR-01", "Register an account, authenticate with a bearer token, and keep the account in an explicit lifecycle state.", "Authentication routes and account-state tests", "Implemented"],
         ["FR-02", "Register a repository from a Git URL or an uploaded ZIP archive, rejecting non-archives and unsafe members.", "Repository routes, ingestion tests", "Implemented"],
         ["FR-03", "Start a scan in any of four configurations and observe per-stage progress and failure reasons.", "Scan routes, orchestrator tests", "Implemented"],
         ["FR-04", "Cancel a running scan cooperatively at the next stage boundary.", "Scan cancellation route and tests", "Implemented"],
         ["FR-05", "Parse supported languages into symbols, imports and call sites, tolerating failures per file.", "Parsing module and tests", "Implemented"],
         ["FR-06", "Apply deterministic detectors and record stable rule identifiers with structured evidence.", "Detector tests, rule catalogue", "Implemented"],
         ["FR-07", "Resolve cross-file caller and callee relationships for any candidate location.", "Knowledge module, orchestrator tests", "Implemented"],
         ["FR-08", "Build a bounded context package per candidate and redact likely secrets before transmission.", "Context and redaction modules", "Implemented"],
         ["FR-09", "Obtain a structured assessment from a configured provider and fail the stage gracefully when none is configured.", "Provider tests, scan summary", "Implemented"],
         ["FR-10", "Adjudicate candidates into VERIFIED, PROBABLE or REJECTED with an ordered evidence chain.", "Evidence module and tests", "Implemented"],
         ["FR-11", "List, filter and inspect findings with evidence, patches and impact context.", "Finding routes and tests", "Implemented"],
         ["FR-12", "Generate a candidate repair, preferring a deterministic template and falling back to the model.", "Repair module, patch tests", "Implemented"],
         ["FR-13", "Validate that a generated diff applies before storing it, rejecting patches that escape the repository or exceed size limits.", "Patch operations and tests", "Implemented"],
         ["FR-14", "Verify a patch in an isolated sandbox: apply, static baseline, tests, re-analysis, verdict.", "Verification module and tests", "Implemented"],
         ["FR-15", "Export a scan report as structured JSON or downloadable Markdown, and findings as SARIF.", "Report and SARIF modules and tests", "Implemented"],
         ["FR-16", "Share a sanitised report through a secret URL containing no credentials or secrets.", "Sharing service, feedback and sharing tests", "Implemented"],
         ["FR-17", "Run a passive website audit with a bounded same-origin crawl and deterministic scoring.", "Website routes, crawler, website tests", "Implemented"],
         ["FR-18", "Group repositories into organisations with ranked membership roles.", "Organisation routes and team tests", "Implemented"],
         ["FR-19", "Issue personal API tokens for headless access, storing only a hash of the secret.", "Token routes, model definition", "Implemented"],
         ["FR-20", "Compute precision, recall, F1 and false-positive rate from real runs against ground truth.", "Benchmark package and tests", "Implemented"],
         ["FR-21", "Charge for paid plans and enforce entitlements.", "Billing service and routes", "Documented"],
         ["FR-22", "Deliver authentication mail through a configured backend.", "Mailer service", "Documented"],
         ["FR-23", "Run the pipeline across multiple workers behind a durable job queue.", "—", "Planned"],
     ]},

    {"t": "h2", "num": "6.3", "title": "Non-functional requirements"},
    {"t": "p", "text":
     "The non-functional requirements are the part of the specification that most distinguishes this system, "
     "because several of them are honesty properties rather than performance properties. Each is expressed as a "
     "testable statement and traced to the mechanism that enforces it."},
    {"t": "table", "caption": "Non-functional requirements and the mechanism enforcing each",
     "source": "Source: Project repository — docs/security.md, docs/verification.md, backend/app/core/config.py, SECURITY.md.",
     "cols": [9, 37, 40, 14],
     "head": ["ID", "Requirement", "Mechanism", "Status"],
     "rows": [
         ["NFR-01", "Repository security. Uploaded and cloned code must never execute on the host during analysis.", "Analysis stages read and parse only; execution is confined to the sandbox runner.", "Implemented"],
         ["NFR-02", "Isolation. Verification executes inside a container with CPU, memory, process and wall-clock limits and a controlled network.", "Sandbox runner configuration with documented defaults.", "Implemented"],
         ["NFR-03", "Secret hygiene. Credentials must not reach a provider or appear in a shared report.", "Redaction before model calls; sanitised sharing assembly; environment-only secrets.", "Implemented"],
         ["NFR-04", "Data minimisation. Never send a whole repository to a model; send a bounded context package.", "Context builder with a character cap per package.", "Implemented"],
         ["NFR-05", "Reproducibility. Every completed scan records analyzer, prompt, model, tool versions, commit and timestamp.", "Reproducibility block written to the scan summary.", "Implemented"],
         ["NFR-06", "Honesty. A value that has not been measured is reported as TBD; a stage that could not run is recorded as failed.", "Undefined ratios propagate as null; per-stage analysis runs; graceful degradation paths.", "Implemented"],
         ["NFR-07", "Authorisation. Every repository-scoped resource is checked for ownership or organisation membership.", "Dependency-injected access checks on every route; non-owners receive the same response as anonymous callers.", "Implemented"],
         ["NFR-08", "Abuse resistance. Authentication attempts are rate-limited per client and per account with progressive backoff rather than permanent lockout.", "Tiered rate limiter with configurable windows and backoff.", "Implemented"],
         ["NFR-09", "Resilience. A failure in one optional stage must not destroy the value of the stages that succeeded.", "Per-run status recording; optional tools degrade; model failures are isolated per candidate.", "Implemented"],
         ["NFR-10", "Maintainability. Module boundaries must be explicit enough that a component can be replaced in isolation.", "Modular monolith with one responsibility per module; provider, runner and scheduler seams.", "Implemented"],
         ["NFR-11", "Portability. The development environment must run without external services.", "SQLite support, console mail backend, mock provider, local static tools.", "Implemented"],
         ["NFR-12", "Observability. Operational signals must be exposed for monitoring and incident review.", "Health endpoint, structured logging, metrics middleware, operational scripts and a cadence workflow.", "Implemented"],
         ["NFR-13", "Horizontal scalability beyond a single worker.", "Requires a job queue and shared rate-limit backend.", "Planned"],
     ]},

    {"t": "h2", "num": "6.4", "title": "Constraints and assumptions"},
    {"t": "p", "text":
     "The system assumes that Docker is available on the host where verification runs; when it is not, the "
     "verification stage reports that it could not establish a verdict rather than guessing. It assumes that a "
     "model provider key is configured for the reasoning stage; without one, deterministic analysis still "
     "completes. It assumes Git is available for repository ingestion from a URL, and that outbound network access "
     "is permitted for cloning and for provider calls. It assumes that the repositories it audits are small enough "
     "to satisfy the ingestion limits — by default one hundred megabytes per repository, one megabyte per file and "
     "five thousand files — and it records a readable error rather than truncating silently when those limits are "
     "exceeded."},
    {"t": "p", "text":
     "Three engine-level constraints are inherited from the design rather than imposed from outside. Analysis is "
     "single-process and in-process, which bounds throughput but keeps the deployment simple; the repository "
     "documents this as a deliberate MVP decision with a scheduler seam for later replacement. Rate limiting is "
     "held in memory, so a multi-worker deployment would need a shared backend before the limits are meaningful. "
     "And parsing depends on tree-sitter grammars, so the set of analysed languages is a function of the grammars "
     "that have been wired in, not of anything the model knows."},

    {"t": "h2", "num": "6.5", "title": "Requirement traceability"},
    {"t": "p", "text":
     "Traceability is maintained in two directions. Forward, each functional requirement maps to the chapter "
     "describing its implementation and to the test module listed in Chapter 12. Backward, every user-visible "
     "capability described in Chapter 10 corresponds to at least one functional requirement, so the interface "
     "contains no orphan features. The two requirements that are marked Documented rather than Implemented — "
     "billing and mail delivery — are traced to external services and are excluded from the claims made in the "
     "results chapter. The one that is marked Planned is excluded from every claim in the report except the "
     "future-work chapter."},
    {"t": "p", "text":
     "This discipline is what allows the report to be specific later. When Chapter 12 states that a behaviour is "
     "covered by a named test module, that statement can be verified by opening the module. When Chapter 14 states "
     "that a metric is pending, it is stating a fact about an unexecuted experiment rather than an apology. The "
     "requirements table is therefore not a formality but the accounting system for the rest of the document."},
]

# ====================================================================== CHAPTER 7
CHAPTERS += [
    {"t": "h1", "num": "7", "title": "System Architecture and Module Design"},
    {"t": "h2", "num": "7.1", "title": "Architectural style"},
    {"t": "p", "text":
     "RepoVeriX is a modular monolith. A single FastAPI process owns ingestion, analysis, model interaction, repair "
     "and verification; a Next.js application provides the developer interface; PostgreSQL is the source of truth. "
     "The choice is documented as deliberate, with the alternatives explicitly rejected: no Kubernetes, no "
     "microservices. For a research prototype the trade is straightforward. A monolith keeps the pipeline in one "
     "debugger, makes an end-to-end scan reproducible from a single command, and avoids distributing a workflow "
     "whose stages share an enormous amount of intermediate state — parsed files, the knowledge graph, candidate "
     "lists — that would otherwise have to be serialised between services."},
    {"t": "p", "text":
     "The monolith is modular in a specific sense: each analysis concern lives in its own module with a narrow "
     "interface, and the three places where a future system would need to diverge are isolated behind seams. The "
     "model provider is a seam with six implementations behind one interface. The execution runner is a seam with "
     "a container runner for production and a local runner for tests and continuous integration. The background "
     "scheduler is a seam whose replacement by a durable job queue would not touch a single route. This is what "
     "allows the repository to claim both simplicity today and a credible path afterwards."},
    {"t": "figure", "path": f"{FIG}/fig01_architecture.png", "width": 0.95,
     "caption": "Layered architecture of RepoVeriX across presentation, API, analysis, and data and execution layers",
     "source": "Source: Project repository — docs/architecture.md, API route inventory, frontend route tree."},

    {"t": "h2", "num": "7.2", "title": "Layer responsibilities"},
    {"t": "table", "caption": "Layers, their components and their responsibilities",
     "source": "Source: Project repository — backend/app layout and frontend/src layout.",
     "cols": [18, 30, 52],
     "head": ["Layer", "Components", "Responsibility and boundary rule"],
     "rows": [
         ["Presentation", "Next.js App Router pages, shared components, generated API client helpers.",
          "Renders state and collects intent. Contains no analysis logic; every number it shows comes from an API response."],
         ["API", "22 FastAPI routers, request and response schemas, authentication and authorisation dependencies.",
          "Validates input, enforces ownership and entitlements, schedules long work, returns typed responses. Holds no analysis state."],
         ["Analysis engine", "45 modules covering ingestion, parsing, knowledge, detectors, context, reasoning, evidence, repair and verification.",
          "All domain logic. Each module has one responsibility and exposes data classes rather than database rows where possible."],
         ["Benchmark", "Experiment runner, metric computation, command-line entry point.",
          "Runs the real orchestrator against fixture repositories in isolation and scores the output against ground truth."],
         ["Data", "SQLAlchemy models, async session handling, migrations, repository storage.",
          "Persistence and isolation. Large free text is truncated at write time; deletes cascade from owner to verification runs."],
         ["Execution", "Container runner with resource limits, local runner for tests.",
          "The only place where untrusted code executes. Receives a directory and a command, returns exit status, logs and parsed test results."],
     ]},

    {"t": "h2", "num": "7.3", "title": "Repository ingestion and input processing"},
    {"t": "p", "text":
     "Ingestion is where an untrusted artefact first touches the system, so it is also where the security model "
     "begins. Two paths exist. The Git path performs a shallow clone with a timeout into a per-repository directory "
     "under the configured storage root, and removes the version-control metadata afterwards so that a later stage "
     "cannot accidentally treat it as source. The archive path is stricter. The upload is validated by magic bytes "
     "before it is stored, so a renamed file is rejected early rather than failing obscurely during extraction. "
     "Extraction then enforces three independent limits — total archive size, per-file size and file count — and "
     "rejects any member whose path is absolute or contains a parent-directory traversal. A single wrapper folder, "
     "which is what most hosting providers produce when a repository is exported, is unwrapped so that analysis "
     "sees the project root rather than the wrapper."},
    {"t": "p", "text":
     "After extraction, a discovery pass walks the tree and produces a manifest. It applies ignore rules for "
     "vendor and build directories, refuses to follow symbolic links out of the repository root, detects "
     "languages from extensions, identifies package managers from manifest files, detects test frameworks from "
     "configuration and naming conventions, and reads declared dependencies with their versions and development "
     "flags. This manifest is what allows the rest of the pipeline to be selective: the parser only visits files "
     "whose language it supports, and the report can state which package ecosystem a dependency belongs to."},
    {"t": "p", "text":
     "The isolation guarantee is worth stating plainly because it is a promise the system makes to the owner of "
     "every audited repository. The uploaded archive is stored, extracted once into a working copy, and never "
     "rewritten. Repairs are produced as unified diffs. Verification copies the working copy into a sandbox "
     "directory, applies the diff there, runs, and deletes the sandbox afterwards. At no point does a repair or a "
     "verification modify the files that belong to the user."},

    {"t": "h2", "num": "7.4", "title": "Module inventory of the analysis engine"},
    {"t": "p", "text":
     "The engine is the largest part of the repository: forty-five Python modules and roughly thirteen and a half "
     "thousand lines. Grouping them by responsibility makes the shape of the system legible in a way that a list "
     "of file names cannot. Ingestion and discovery are carried by three modules that handle safe extraction and "
     "cloning, file walking under configured limits, and asynchronous subprocess execution for Git and for the "
     "external lint tools. Structural analysis is carried by three more: the parser over three grammars, the "
     "knowledge layer that resolves symbols, imports and calls, and an architecture-smell analyser that reads the "
     "import graph for hubs, cycles, god modules, unstable modules and orphans."},
    {"t": "p", "text":
     "Detection occupies three modules — the built-in rule set, the adapters for optional external tools, and a "
     "historical miner that traces a finding back to the commit that introduced it. Reasoning support is a group "
     "of three: the context builder, the redaction pass and the provider abstraction with its retries, JSON "
     "parsing and usage accounting. Adjudication spreads across five modules, of which the evidence engine is the "
     "core and counterexample validation, predictive risk scoring and self-improving rule selection are the "
     "satellites. Repair uses three modules for generation, diff operations and patch-quality scoring. "
     "Verification uses four, adding proof-of-fix aggregation, regression matching and regression-test generation "
     "to the sandbox runner. Orchestration uses three for stage execution, in-process scheduling and recovery of "
     "interrupted jobs. Repository intelligence is the widest group, with eight modules covering the file-level "
     "wiki, health scoring, Git history analytics, impact analysis, natural-language queries, change explanation, "
     "change auditing and pull-request auditing. Web auditing has three, and five research extensions sit at the "
     "edge."},
    {"t": "p", "text":
     "The size distribution is informative. The detector module is the largest single file, which is unsurprising: "
     "each rule carries a matching strategy, a severity, structured evidence construction and language variants. "
     "Parsing is second, because three grammars mean three sets of node mappings. The long tail of small modules — "
     "recovery, runtime, redaction, proof-of-fix — reflects a deliberate policy of one concern per file, so that a "
     "reviewer can read any module in a single sitting and a change cannot hide in a thousand-line file."},
    {"t": "h2", "num": "7.5", "title": "Parsing and the structural model"},
    {"t": "p", "text":
     "Parsing is the boundary between text and structure. The parser exposes one function that accepts a language, "
     "a source string and a relative path, and returns a parsed-file value object containing functions, methods, "
     "classes, decorated definitions, imports and call expressions with their locations. Tree-sitter supplies the "
     "concrete syntax tree; the module supplies node-type mappings per language. Python's decorated definitions, "
     "JavaScript's arrow functions and TypeScript's type annotations are handled by those mappings rather than by "
     "special cases scattered through the pipeline."},
    {"t": "p", "text":
     "Two design decisions inside the parser matter downstream. First, relative imports are resolved into "
     "module-qualified names, which is what allows the knowledge graph to draw an edge between a call site in one "
     "file and a definition in another. Second, every parse records failures per file instead of raising. A "
     "repository containing a file that today's grammar cannot parse still produces a complete audit of everything "
     "else, with a warning attached; this is the same resilience principle that governs model failures and missing "
     "external tools."},

    {"t": "h2", "num": "7.6", "title": "The knowledge layer"},
    {"t": "p", "text":
     "The knowledge graph turns a collection of parsed files into a repository. It indexes every symbol by simple "
     "and qualified name, records which file each symbol lives in, records which files import which other files, "
     "and resolves calls through those imports so that the caller of a function can be found. Three consequences "
     "follow. A candidate found in a leaf function can be annotated with the functions that call it, which is "
     "exactly the evidence needed to argue that untrusted input reaches it. The context builder can assemble a "
     "package containing the enclosing function plus its immediate neighbours instead of guessing at relevance. "
     "And architecture-level analysis becomes possible, because the import graph is a first-class artefact rather "
     "than a by-product."},
    {"t": "p", "text":
     "The same graph supports several delivered capabilities beyond the core audit. Architecture-smell detection "
     "finds hub modules with excessive fan-in, dependency cycles, god modules, unstable modules and orphans — "
     "structural observations that no pattern rule could make. Attack-path analysis performs a breadth-first "
     "search from functions that read untrusted input to functions that reach sensitive sinks, producing a path "
     "rather than a point. Dependency reachability answers, for each declared dependency, whether repository source "
     "actually imports it, with four explicit statuses from directly reachable down to unreferenced. Each of these "
     "produces structured evidence, which is the recurring theme of this architecture."},

    {"t": "h2", "num": "7.7", "title": "Deterministic detection"},
    {"t": "p", "text":
     "The built-in rule set is the deterministic floor of the system. It runs on every scan, requires no external "
     "service, and produces findings whose shape is predictable enough to be repaired by template. Each rule "
     "carries a stable identifier, a severity, a category, a confidence value and structured evidence. Language "
     "variants carry a language segment in the identifier, so a JavaScript SQL-injection finding is distinguishable "
     "from its Python counterpart while still belonging to the same rule family — which is precisely the property "
     "the benchmark's matching logic relies on."},
    {"t": "table", "caption": "Built-in detection rules shipped with the repository",
     "source": "Source: Project repository — backend/app/analysis/detectors.py and the rule catalogue in frontend/src/lib/rules.",
     "cols": [22, 30, 12, 36],
     "head": ["Rule identifier", "Defect class", "Default severity", "Detection idea"],
     "rows": [
         ["RVX-SQLI-001", "SQL injection in Python", "Critical", "A cursor execution whose query was assembled by f-string, concatenation or percent formatting; severity raised when the interpolated value traces to a function parameter."],
         ["RVX-SQLI-JS-001", "SQL injection in JavaScript", "High", "Dynamic SQL executed against a database client where a template literal or concatenation built the query."],
         ["RVX-SECRET-001", "Hardcoded credential, primary pattern", "High", "A credential-shaped assignment in module scope or a literal passed to a secret-named parameter."],
         ["RVX-SECRET-002", "Hardcoded credential, secondary pattern", "High", "Variant assignment shapes and provider-specific prefixes."],
         ["RVX-SECRET-JS-001", "Hardcoded credential in JavaScript", "High", "A secret-shaped constant assigned in a module."],
         ["RVX-CMDI-001", "Command injection in Python", "High", "Shell invocation with a constructed command string, including the shell-true form of the subprocess family."],
         ["RVX-CMDI-JS-001", "Command injection in JavaScript", "High", "Dynamic command interpolation into a child-process execution call."],
         ["RVX-EVAL-001", "Unsafe dynamic evaluation in Python", "High", "Evaluation of a caller-supplied expression."],
         ["RVX-EVAL-JS-001", "Unsafe dynamic evaluation in JavaScript", "Medium", "Evaluation or function construction from caller-supplied input."],
         ["RVX-CRYPTO-001", "Weak cryptographic hash", "Medium", "Use of a hash primitive that is unsuitable for token or password material."],
         ["RVX-EXCEPT-001", "Broad exception swallowing", "Low", "A handler that catches everything and discards the error, a reliability rather than a security defect."],
     ]},
    {"t": "p", "text":
     "External tools are integrated as optional participants. A small adapter layer checks whether each binary is "
     "present, runs it with a normalised invocation, and converts its output into the system's own finding "
     "structure. When a tool is missing the adapter reports unavailability, the scan records the capability gap in "
     "its summary, and the audit proceeds. This is a deliberate departure from the common pattern of making a "
     "scanner fail when a plugin is absent, and it exists because the prototype must be runnable in environments "
     "where those tools are not installed."},

    {"t": "h2", "num": "7.8", "title": "Context assembly and model reasoning"},
    {"t": "p", "text":
     "The reasoning stage is where the project's central caution is most visible, because the obvious design — "
     "send the repository to a model and ask what is wrong — is rejected on three grounds simultaneously: cost, "
     "the attention limits of the model, and the fact that a whole-repository prompt makes the resulting claim "
     "impossible to localise. Instead, the context builder assembles a package per candidate, bounded by a "
     "configured character limit, containing the affected file and the enclosing function window, callers and "
     "callees resolved through the knowledge graph, the imports that reach and leave the file, and the static "
     "evidence already collected."},
    {"t": "p", "text":
     "Before the package leaves the process, redaction rewrites likely credentials. This is a subtle but important "
     "distinction: detecting a hardcoded secret is a finding, and shipping that secret to a third-party provider "
     "would be an exfiltration. The system does the first and prevents the second. The redaction pass removes "
     "API-key-shaped strings and private-key headers from any snippet used in prompt construction."},
    {"t": "p", "text":
     "Prompts are versioned files rather than inline strings, which is what makes the reproducibility block "
     "meaningful: a scan records which prompt version produced its model output. Nine prompt templates ship with "
     "the repository, covering the system security preamble, per-finding analysis, repository review, repair "
     "generation, test generation, change explanation, repository query, finding conversation and wiki prose. The "
     "provider abstraction exposes one interface with six implementations — OpenAI and compatible endpoints, "
     "Anthropic, Gemini, OpenRouter, NVIDIA gateway and a deterministic mock used by tests — with timeouts, bounded "
     "retries, JSON parsing and usage accounting. Multiple configured providers form an ordered fallback chain, so "
     "a timeout at the primary does not end the stage."},

    {"t": "h2", "num": "7.9", "title": "The evidence and validation model"},
    {"t": "p", "text":
     "The evidence model is the intellectual centre of the system. It separates three things that comparable tools "
     "tend to blur: what a model claims, what the repository supports, and what has been established by execution. "
     "A finding is the outcome of validation, not the outcome of a prompt."},
    {"t": "figure", "path": f"{FIG}/fig03_evidence_chain.png", "width": 0.95,
     "caption": "Evidence chain node kinds and the deterministic adjudication rules",
     "source": "Source: Project repository — docs/evidence-model.md and backend/app/analysis/evidence.py."},
    {"t": "p", "text":
     "An evidence chain is an ordered list of typed nodes. A source node records where untrusted input enters, "
     "with file, line and snippet. A transformation node records how that input is manipulated — an f-string, a "
     "concatenation, a formatted string. A sink node records the dangerous operation. A call-relationship node "
     "records that some caller, possibly passing untrusted data, invokes the enclosing function. A static-analysis "
     "node records the rule that fired and the structural shape it matched. An LLM-reasoning node records the "
     "model's structured assessment, explicitly marked as reasoning rather than verdict. The chain is data, stored "
     "in rows ordered by index, not prose generated after the fact."},
    {"t": "p", "text":
     "Adjudication then applies rules in code. A candidate becomes VERIFIED when the sink is located and the path "
     "from source through transformation to sink is established in repository code. It becomes PROBABLE when a "
     "sink and part of a chain exist but the path cannot be fully established. It becomes REJECTED when grounding "
     "is insufficient — and rejected candidates are counted and reported rather than quietly discarded, so the "
     "audit trail remains honest and the false-positive analysis has data to work with. The model can influence "
     "confidence and add reasoning nodes; it cannot satisfy the minimum-evidence condition on its own."},
    {"t": "p", "text":
     "Two further mechanisms sharpen adjudication. Counterexample checking asks whether a value that reaches a sink "
     "passes through a sanitiser — parameterisation, escaping, coercion, validation — and if so, whether the claim "
     "can still hold; this is how the system avoids the classic false positive of flagging a correctly "
     "parameterised query that happens to sit near a string build. Validation runs a deterministic battery of "
     "checks in which the validator deliberately opposes the claim, which is the opposite of asking another model "
     "whether the first one was right. Findings are de-duplicated on a stable identifier derived from rule, file "
     "and line, so re-running a scan over an unchanged repository is idempotent."},

    {"t": "h2", "num": "7.10", "title": "Repair generation"},
    {"t": "p", "text":
     "Repair follows the same two-tier philosophy as detection. Deterministic templates come first. A template "
     "exists for each of the strong rule families — parameterised queries for SQL injection, environment "
     "indirection for hardcoded secrets, argument-form invocation for command injection, removal of dynamic "
     "evaluation, and a stronger hash for weak cryptography. A template fires only when the source matches the "
     "shape it was written for, and it verifies that the expected lines still exist before producing a diff. If the "
     "shape has drifted, the template refuses rather than guessing, which is a small decision with a large effect "
     "on the trustworthiness of the output."},
    {"t": "figure", "path": f"{FIG}/fig15_repair_decision.png", "width": 0.95,
     "caption": "Repair generation path from finding to candidate patch",
     "source": "Source: Project repository — backend/app/analysis/repair.py and docs/verification.md."},
    {"t": "p", "text":
     "When no template applies and a provider is configured, the model generates a repair against a versioned "
     "prompt. The result is not trusted because it was generated; it is accepted only if it parses as a diff, "
     "targets real files inside the repository, stays within a size bound, and applies cleanly to the working "
     "copy. Those checks happen before the patch is stored, so a stored patch is always at least applicable — the "
     "sandbox then decides whether it is correct. Patch quality is scored deterministically before and after "
     "verification, combining hard signals from execution with shape signals such as scope, minimality and "
     "hygiene, and a proof-of-fix record aggregates what actually happened to every patch attached to a finding."},

    {"t": "h2", "num": "7.11", "title": "The verification engine"},
    {"t": "p", "text":
     "Verification is the second place where the system refuses to accept an assertion. The workflow is a "
     "five-step sequence over a disposable copy, and every step writes to a log that the interface displays."},
    {"t": "figure", "path": f"{FIG}/fig05_verification.png", "width": 0.95,
     "caption": "Sandboxed verification workflow and the outcome vocabulary",
     "source": "Source: Project repository — docs/verification.md and backend/app/analysis/verify.py."},
    {"t": "p", "text":
     "The first step copies the scan's working copy into a per-verification sandbox directory. The second applies "
     "the unified diff, validating every hunk and rejecting any target path that would escape the sandbox; a "
     "mismatch is a structured failure, not an exception that escapes the runner. The third runs static checks on "
     "the changed files and compares the result against a pre-patch baseline, so only issues the patch introduces "
     "count against it — pre-existing issues elsewhere in the repository are logged but do not block a "
     "finding-level verdict. The fourth runs the project's own tests in the isolated runner and parses per-test "
     "outcomes from machine-readable test output into individual result rows. The fifth re-runs the built-in "
     "detectors on the patched file and requires that the original rule no longer fires inside the same function, "
     "or near the same lines when the function cannot be identified."},
    {"t": "p", "text":
     "Only the conjunction of these conditions produces a verified repair. This matters for the case that tests "
     "alone would miss: a repository whose test suite never covered the vulnerable path. There, the tests pass "
     "before and after, and only the re-analysis step can distinguish a real fix from an unrelated edit. The "
     "system therefore records five outcomes — pending, running, verified repair, repair failed, and repair not "
     "verified — where the last is reserved for the situation in which execution could not establish a verdict at "
     "all: no Docker daemon, a timeout, or an internal error. That distinction between *failed* and *could not "
     "be determined* is the difference between a verdict and an excuse, and the interface presents them "
     "differently."},

    {"t": "h2", "num": "7.12", "title": "The security model"},
    {"t": "p", "text":
     "Security is treated as an architectural property because the system's input is hostile by definition. The "
     "threat model has four entry points and a matching control for each."},
    {"t": "figure", "path": f"{FIG}/fig07_security.png", "width": 0.95,
     "caption": "Untrusted domain, enforced controls, and the boundary between them",
     "source": "Source: Project repository — docs/security.md and SECURITY.md."},
    {"t": "table", "caption": "Threat entry points and the controls that address them",
     "source": "Source: Project repository — docs/security.md, backend/app/core/ssrf.py, backend/app/core/ratelimit.py.",
     "cols": [24, 38, 38],
     "head": ["Entry point", "Threat", "Control"],
     "rows": [
         ["Uploaded archive", "Path traversal, archive bomb, oversized payload, disguised file type.",
          "Magic-byte validation before storage; rejection of absolute and parent-directory members; separate caps on archive size, file size and file count."],
         ["Cloned repository", "Arbitrary source text, build scripts, dependency installers.",
          "Analysis only reads and parses. Execution happens solely in the container runner with CPU, memory, process and wall-clock limits, a controlled network and no host secrets."],
         ["Repository text in prompts", "Instruction injection, credential exfiltration through prompt content.",
          "Fixed system prompt; repository content confined to delimited data sections; secret redaction on every snippet."],
         ["Generated patch", "Targets outside the repository, oversized diffs, unparsable content.",
          "Diff parsing and target validation, size bounds, applicability check before storage, sandbox-confined application."],
         ["HTTP interface", "Unauthorised access to another user's repository, credential stuffing, resource exhaustion.",
          "Bearer-token authentication, ownership and membership checks on every resource route, tiered rate limiting with progressive backoff, per-scan candidate and context caps."],
     ]},
    {"t": "p", "text":
     "The container boundary deserves one further sentence, because it is the only place where the system runs "
     "code it did not write. The runner receives a directory and a command; it starts a container with a memory "
     "limit, a CPU limit, a process cap and a timeout; it mounts only the sandbox directory; it passes a minimal "
     "environment containing no application secrets; and it destroys the container afterwards. When the daemon is "
     "unreachable, the verification row records that the runner was unavailable. The repository documentation is "
     "explicit that mounting the daemon socket grants control of the daemon and should only be done on a host "
     "dedicated to this application — a caveat that belongs in an operator guide and is reproduced in Chapter 17."},

    {"t": "h2", "num": "7.13", "title": "The website-audit subsystem"},
    {"t": "p", "text":
     "A second, independent capability audits public websites passively. It is architecturally separate from "
     "repository analysis and shares only the persistence and authorisation layers, which is deliberate: the "
     "safety argument for a crawler is different from the safety argument for a sandbox, and mixing them would "
     "obscure both. The crawler follows links only within the registered hostname, respects robots.txt, waits "
     "between requests, caps pages, depth, response size and request time, and preflights every request and every "
     "redirect hop through an SSRF gate that rejects private, loopback, link-local and metadata address ranges and "
     "pins the connection to the validated address so that DNS rebinding cannot defeat the check."},
    {"t": "figure", "path": f"{FIG}/fig08_sandbox.png", "width": 0.95,
     "caption": "Execution isolation: host boundaries around the ephemeral verification container",
     "source": "Source: Project repository — docs/verification.md, backend/app/analysis/verify.py, docker-compose files."},
    {"t": "p", "text":
     "What the subsystem measures is limited on purpose: technical search metadata, passively observed security "
     "posture, accessibility signals, response-time and page-weight observations, AI-search readiness and crawl "
     "health. Scores are computed deterministically from the captured evidence and are labelled as the project's "
     "own analytical scores. The documentation is careful about three things a marketing page would blur: the "
     "performance dimension is not a Lighthouse run and produces no Core Web Vitals, the accessibility checks are "
     "automated DOM checks rather than a conformance audit, and a high score is not a security certification. "
     "Where evidence is insufficient, the score is null and the finding carries an explicit insufficient state."},
]

# ====================================================================== CHAPTER 8
CHAPTERS += [
    {"t": "h1", "num": "8", "title": "Data Model and Persistence"},
    {"t": "h2", "num": "8.1", "title": "Storage strategy"},
    {"t": "p", "text":
     "Persistence uses SQLAlchemy 2 with typed declarative models over an asynchronous engine. PostgreSQL is the "
     "production database and the default configuration; SQLite over an asynchronous driver is supported for "
     "development and for the test suite, which is what allows the entire pipeline to be exercised on a laptop "
     "without a database server. Configuration is entirely environment-driven through a single settings object "
     "with a consistent prefix, so no connection string is ever hardcoded in application code."},
    {"t": "p", "text":
     "The schema contains twenty-eight mapped tables. Rather than present all of them as a wall of boxes, this "
     "chapter separates the audit spine — the chain from a user to a verified repair — from the surrounding "
     "capability tables that support collaboration, billing, security events and website audits. The spine is what "
     "the rest of the report refers to when it speaks about a finding or a verification."},
    {"t": "p", "text":
     "The separation reflects a genuine difference in how the two groups are written. Spine rows are append-mostly "
     "and auditable: a finding is created once and then annotated, an evidence chain is written in order and never "
     "reordered, and a verification run moves through a short state machine and then stops. Capability rows, by "
     "contrast, accumulate: feedback, shares, security events, health snapshots and audit histories all grow "
     "monotonically alongside the spine without participating in its logic. Keeping them in separate tables means "
     "that the audit query the interface runs most often — findings for a scan with their evidence and "
     "verifications — touches a small, well-indexed set of relations rather than a large one."},
    {"t": "p", "text":
     "Two modelling habits recur across the schema. First, structured detail is stored as a JSON payload column "
     "rather than being normalised prematurely: a scan summary carries the reproducibility block and token "
     "accounting, an analysis run carries its stage output, and a website audit carries its scores, pages, "
     "findings and evidence. This keeps the relational surface stable while the analysis evolves, at the cost of "
     "queryability that the interface does not currently need. Second, the columns that a reader will want to "
     "filter on — severity, status, category, language, stage — are ordinary typed columns with indexes, never "
     "buried inside a payload. The rule is simple: filter in columns, explain in JSON."},
    {"t": "figure", "path": f"{FIG}/fig06_data_model.png", "width": 0.95,
     "caption": "Entity relationships on the audit spine, from user to verification result",
     "source": "Source: Project repository — docs/database.md and backend/app/db/models.py."},

    {"t": "h2", "num": "8.2", "title": "Entities on the audit spine"},
    {"t": "table", "caption": "Core entities, key attributes and the invariant each enforces",
     "source": "Source: Project repository — backend/app/db/models.py.",
     "cols": [17, 40, 43],
     "head": ["Table", "Key attributes", "Invariant"],
     "rows": [
         ["users", "Identifier, unique email, hashed password, full name, plan, lifecycle status, subscription status.",
          "A password is never stored in recoverable form; account states are explicit and gate behaviour server-side."],
         ["repositories", "Owner, source type, source URL, default branch, storage path, primary languages, status.",
          "One row per registered repository; the storage path is derived and isolated per repository."],
         ["scans", "Repository, configuration, status, start and finish time, JSON summary, token usage, error text.",
          "A scan is the audit unit; the summary carries the reproducibility block and the token accounting."],
         ["analysis_runs", "Scan, stage, tool name, status, JSON output, timing.",
          "One row per pipeline stage, so no stage can be silently skipped."],
         ["files", "Scan, path, language, size, content hash, test flag.",
          "Parsed metadata is reconstructable and de-duplicable without re-reading the repository."],
         ["symbols", "File, kind, name, qualified name, line range, metadata.",
          "Every call or evidence node can be resolved back to a source location."],
         ["dependencies", "Scan, ecosystem, name, version, development flag.",
          "Declared dependencies are inventoried with their ecosystem and pinned version where the manifest provides one."],
         ["findings", "Scan, external identifier unique per scan, category, severity, status, confidence, title, description, impact, recommendation, location, source.",
          "Re-running a scan over an unchanged repository does not duplicate findings."],
         ["evidence", "Finding, kind, file, line range, snippet, description, order index, metadata.",
          "The chain is ordered data, not prose; each node names the location it came from."],
         ["patches", "Finding, unified diff, explanation, generator identity, status.",
          "A stored patch has already been validated as applicable."],
         ["verification_runs", "Patch, status, per-step booleans for apply, dependency install, tests and static checks, re-detection flag, logs, timing.",
          "A verdict is a record of execution, not of intent."],
         ["test_results", "Verification run, test name, outcome, captured output.",
          "Individual test outcomes are available for inspection rather than summarised into a single pass or fail."],
     ]},
    {"t": "p", "text":
     "Several cross-cutting conventions make the schema predictable. Primary keys are universally unique "
     "identifiers rather than integers, so a resource identifier cannot be enumerated and cannot leak creation "
     "order. Every table carries creation and update timestamps from a shared mixin. Enumerations are stored as "
     "their declared values rather than their member names, which keeps the database readable and stable when a "
     "member is renamed in code. Deletes cascade from owner to repository to scan to finding to patch to "
     "verification run, so removing an account cannot leave orphaned evidence. Large free text — evidence "
     "snippets, execution logs, diffs — lives in unbounded text columns and is truncated at write time to a "
     "configured maximum, which prevents a pathological repository from filling the database with a single log."},

    {"t": "h2", "num": "8.3", "title": "Surrounding capability tables"},
    {"t": "p", "text":
     "Beyond the spine, the schema supports the product capabilities described in Chapter 10. Accounts have linked "
     "OAuth identities, one-time email tokens, security events, personal API tokens stored only as hashes, and "
     "subscription records. Organisations have memberships with a ranked role, and repositories can belong to an "
     "organisation rather than a single user. Findings support reviewer feedback and sanitised public shares. "
     "Repository intelligence persists insights and health snapshots so that a timeline can be plotted across "
     "scans. Change auditing persists pull-request audits and change audits with their computed blast radius. "
     "The research extensions persist validation runs and generated regression tests. Website auditing has its own "
     "pair of tables with a status machine and JSON payloads for scores, summary, pages, findings and evidence."},
    {"t": "p", "text":
     "Two modelling decisions in that list are worth noting because they recur in the interface. Generated tests "
     "are persisted as first-class rows with a run result, rather than being executed and forgotten, which is what "
     "allows a reviewer to see the contract assertion that demonstrates a defect. And public report shares are "
     "rows without authentication material: the share identifier is the secret, and the payload is a sanitised "
     "assembly that excludes credentials and internal log detail. Both decisions follow the same principle as the "
     "evidence chain — if a claim is made, the artefact supporting it should be addressable."},

    {"t": "h2", "num": "8.4", "title": "Schema evolution"},
    {"t": "p", "text":
     "Ten Alembic revisions ship with the repository. The chain begins with an initial schema and proceeds through "
     "feedback and sharing, organisations and role-based access with tokens, onboarding, account security, website "
     "audits, source-type values, website-audit quota, payment columns, and a final alignment of the schema with "
     "the models. Development and test environments may create tables directly at startup when the corresponding "
     "setting is enabled, which keeps the first-run experience simple; the migration chain exists for deployments "
     "where schema changes must be applied deliberately. The deployment documentation records that the full chain "
     "has been validated against a managed PostgreSQL service, which is the kind of statement this report can "
     "repeat as a documented fact while marking online execution as not performed here."},
]

# ====================================================================== CHAPTER 9
CHAPTERS += [
    {"t": "h1", "num": "9", "title": "API and System Interaction Design"},
    {"t": "h2", "num": "9.1", "title": "Shape of the interface"},
    {"t": "p", "text":
     "The backend exposes a versioned REST interface under a single prefix, documented automatically through the "
     "framework's schema generation, which is available as interactive documentation when the environment enables "
     "it. Every endpoint except the authentication entry points requires a bearer token. Requests and responses are "
     "described by typed schemas, so the generated documentation is accurate rather than aspirational. Errors are "
     "returned with a readable message and a status code that distinguishes absence, conflict and unprocessable "
     "input; internal stack traces are never returned to a client."},
    {"t": "p", "text":
     "The route inventory across the twenty-two routers totals one hundred and twelve declarations. Grouping them "
     "by purpose shows where the interface's weight sits: authentication and account security account for fifteen, "
     "audit, intelligence and research routes for seventeen, findings for eleven, organisations for ten, scans for "
     "eight, repositories for seven, and the remainder distributed across patches and verification, websites, "
     "OAuth, billing, feedback, sharing, tokens, automation, webhooks, pull requests, dashboard and onboarding."},
    {"t": "figure", "path": f"{FIG}/fig10_api_surface.png", "width": 0.95,
     "caption": "Distribution of the 112 HTTP route declarations across router groups",
     "source": "Source: Project repository — measured from backend/app/api/routes."},

    {"t": "h2", "num": "9.2", "title": "Core resource routes"},
    {"t": "table", "caption": "Representative routes from the core audit resources",
     "source": "Source: Project repository — backend/app/api/routes (repositories, scans, findings, patches).",
     "cols": [9, 34, 57],
     "head": ["Method", "Path", "Purpose"],
     "rows": [
         ["POST", "/repositories", "Register a repository from a Git URL with a name, source type and default branch."],
         ["POST", "/repositories/zip", "Upload an archive as multipart form data; the archive is validated, stored and extracted."],
         ["GET", "/repositories", "List the caller's repositories, optionally scoped to an organisation."],
         ["DELETE", "/repositories/{id}", "Delete a repository together with its stored files and dependent rows."],
         ["POST", "/scans", "Start a scan for a repository in one of the four configurations; returns immediately and runs in the background."],
         ["GET", "/scans/{id}", "Scan detail including the per-stage analysis runs, timing and reproducibility block."],
         ["GET", "/scans/{id}/findings", "Findings of the scan with severity and status filters."],
         ["POST", "/scans/{id}/cancel", "Request cooperative cancellation at the next stage boundary."],
         ["GET", "/scans/{id}/report", "Full audit report as a structured object, or as a downloadable Markdown document."],
         ["GET", "/scans/{id}/sarif", "Findings exported in the standard static-analysis results interchange format."],
         ["GET", "/findings", "Cross-scan finding list filtered by scan, repository, category, severity or status."],
         ["GET", "/findings/{id}", "A single finding with its ordered evidence chain and any attached patches."],
         ["POST", "/findings/{id}/generate-fix", "Generate a candidate patch, preferring a template; returns a readable reason when no repair applies."],
         ["POST", "/patches/{id}/verify", "Create and schedule a verification run; conflicts if one is already in flight for the patch."],
         ["GET", "/patches/verification/{id}", "Verification detail including per-test outcomes and execution logs."],
     ]},

    {"t": "h2", "num": "9.3", "title": "Beyond the core: analysis and collaboration surfaces"},
    {"t": "p", "text":
     "The remaining routers expose the capabilities described in Chapters 7 and 10. Repository audit routes cover "
     "change auditing, change explanation, evidence graphs, attack paths, dependency reachability and regression "
     "comparison. Intelligence routes cover the file-level wiki, natural-language repository queries, architecture "
     "smells and the health timeline. Research routes expose multi-agent analysis, self-improvement statistics, "
     "vulnerability mining and the predictive risk model. Organisation routes manage membership, repository "
     "assignment, an organisation dashboard and a security centre. Automation routes chain a repair workflow across "
     "the stored artefacts and re-check a pull-request audit."},
    {"t": "p", "text":
     "This breadth is the reason the interface is described as a workspace rather than a scanner. It is also why "
     "the authorisation model is stated as a non-functional requirement: with one hundred and twelve routes, a "
     "single missing ownership check would be a serious defect. The implementation centralises the check in "
     "dependency functions rather than repeating it per handler, and the access service resolves both personal "
     "ownership and organisation membership through a ranked role comparison. A non-owner receives the same "
     "response as an anonymous caller, which prevents identifier enumeration from revealing whether a resource "
     "exists."},

    {"t": "h2", "num": "9.4", "title": "Interaction sequence for a flagship audit"},
    {"t": "p", "text":
     "The documented end-to-end flow is the clearest specification of how the pieces interact, and it is "
     "reproducible because it is also encoded as a test."},
    {"t": "table", "caption": "Sequence of interactions in the documented end-to-end audit",
     "source": "Source: Project repository — docs/development.md (end-to-end demo) and the verification tests.",
     "cols": [7, 34, 30, 29],
     "head": ["Step", "Client action", "Server behaviour", "Observable result"],
     "rows": [
         ["1", "Create an account and authenticate.", "Password hashed; bearer token issued.", "Token stored by the client."],
         ["2", "Upload the demo archive.", "Magic bytes checked; archive extracted with guards; discovery manifest produced.", "Repository row with detected languages."],
         ["3", "Start a scan in the full configuration.", "Pipeline scheduled in the background; each stage writes an analysis-run row.", "Status advances from pending through running to completed."],
         ["4", "Open the injected-query finding.", "Finding returned with status, severity and ordered evidence chain.", "Source, transformation, sink and caller evidence visible."],
         ["5", "Request a fix.", "Template matched against the source shape; diff validated as applicable.", "Candidate patch with explanation stored."],
         ["6", "Request verification.", "Sandbox copy created, patch applied, baseline compared, tests executed, finding re-analysed.", "Verdict with per-test outcomes and execution logs."],
         ["7", "Download the report.", "Report assembled and rendered from persisted rows.", "Markdown document for printing or archiving."],
     ]},
    {"t": "h2", "num": "9.5", "title": "Interface conventions"},
    {"t": "p", "text":
     "Consistency is enforced by convention rather than by middleware magic, and the conventions are stated in the "
     "API documentation. Identifiers are identifiers in paths. Creation returns the created resource. Deletion of a "
     "resource with dependants cascades and returns no content. Conflicts — a verification already running for the "
     "same patch, an audit already running for the same website — return a conflict status rather than silently "
     "queueing a duplicate. Unprocessable input returns a validation body. Absence and unauthorised access are "
     "deliberately indistinguishable. Report rendering returns structured data for programmatic use and a rendered "
     "document for human use, from the same assembled payload, so the two can never disagree."},
    {"t": "p", "text":
     "The machine-readable export in the standard interchange format is worth calling out as a design decision. It "
     "means the system's output can be consumed by the tooling a developer already has — a code-scanning view, a "
     "dashboard, a pull-request annotation — without that developer adopting the project's own interface. For a "
     "prototype whose value proposition is evidence, being able to hand the evidence to someone else's tooling is "
     "more persuasive than any dashboard of its own."},
]

# ====================================================================== CHAPTER 10
CHAPTERS += [
    {"t": "h1", "num": "10", "title": "Frontend and User-Interface Design"},
    {"t": "h2", "num": "10.1", "title": "Technology and structure"},
    {"t": "p", "text":
     "The interface is a Next.js application using the App Router with TypeScript, styled with Tailwind CSS and "
     "component primitives in the shadcn tradition, with server-state managed through a query library. It comprises "
     "one hundred and twenty-four TypeScript modules and roughly twenty-two and a half thousand lines, organised "
     "into three route groups that separate the public marketing surface, the authentication flow and the "
     "authenticated workspace. Shared components are grouped by domain — repositories, scans, findings, layout, "
     "interface primitives — so that a page composes rather than implements."},
    {"t": "figure", "path": f"{FIG}/fig12_ui_map.png", "width": 0.95,
     "caption": "Route map of the interface across public, documentation, authentication and workspace surfaces",
     "source": "Source: Project repository — frontend/src/app route tree."},

    {"t": "h2", "num": "10.2", "title": "Routes and their purpose"},
    {"t": "p", "text":
     "The route map shows how the forty page routes divide. The public surface describes the product and "
     "carries the documentation set; the authentication group contains sign-in, sign-up, verification, password "
     "recovery and the OAuth callback landing page; the workspace group is where an audit is actually conducted, "
     "moving from the dashboard through repository registration to scan configuration and scan progress; the "
     "findings group holds the triage list, the individual finding, the rule catalogue and the website-audit "
     "surface; and the settings group collects account security, team management, API tokens, billing, onboarding "
     "and help. A reviewer's working path touches four of those groups in sequence, which is why the navigation "
     "model treats the workspace as the primary axis and settings as a terminal branch."},
    {"t": "h2", "num": "10.3", "title": "Designing for evidence rather than for alerts"},
    {"t": "p", "text":
     "The interface's central design problem is not layout but epistemology: how do you present a claim so that "
     "the reader can evaluate it? The answer adopted throughout is to show the working. A finding is not a red "
     "badge with a title; it is a page with four regions. The header states the status and severity and labels "
     "confidence explicitly as a system score. The evidence panel renders the ordered chain, each node naming its "
     "kind, its file and line, and the snippet it came from. The context panel explains why the location matters. "
     "The remediation panel holds the generated diff and the verification control, with the execution log "
     "appearing in place as the run progresses."},
    {"t": "p", "text":
     "The rule catalogue is the same idea applied to the tool itself. Each rule page states how the detector "
     "decides in its own terms, which contextual signals the engine attaches, what its known false-positive shape "
     "is, and how to fix the defect — with an insecure and a secure form side by side. Publishing the rule's "
     "reasoning is a commitment: a reviewer can disagree with a specific decision, and a maintainer cannot quietly "
     "change a rule's behaviour without changing its documentation."},

    {"t": "h2", "num": "10.4", "title": "Interaction states"},
    {"t": "p", "text":
     "Because long operations are asynchronous and sometimes fail, the interface defines explicit states rather "
     "than leaving the user to infer progress. A scan shows its stage list with a live status per stage, so a "
     "reasoning stage that failed for want of a provider key appears as a failure with a reason, not as a silent "
     "gap. A verification shows its five steps in sequence and then one of the five recorded outcomes, with "
     "execution logs available underneath. An empty state distinguishes *nothing has been scanned* from *a scan "
     "produced no findings* from *a scan produced findings that were all rejected* — three situations that a "
     "careless interface collapses into one, to the considerable disadvantage of the user."},
    {"t": "p", "text":
     "The dashboard follows the same rule. It reports counts of findings by severity and by status, which means "
     "rejected candidates are visible as a number rather than vanished. A reviewer can therefore see the "
     "adjudicator working: a run that rejected forty candidates and published six findings is a different "
     "outcome from a run that published six findings and rejected nothing, and the interface lets that difference "
     "be seen without opening a single record."},

    {"t": "h2", "num": "10.5", "title": "Accessibility, responsiveness and honesty in copy"},
    {"t": "p", "text":
     "The interface uses a restrained visual language: a warm canvas, a deep green accent drawn from the project's "
     "own iconography, typographic hierarchy rather than colour coding for severity, and no decorative imagery "
     "that is not doing explanatory work. Components are built with semantic markup and labelled controls, motion "
     "is used sparingly and respects reduced-motion preferences, and the layout is responsive down to narrow "
     "viewports because a reviewer checking a finding on a phone is a realistic case. The copy throughout avoids "
     "the vocabulary of certainty that security products tend to adopt: findings are *supported by evidence* "
     "rather than *confirmed vulnerabilities*, scores are *analytical* rather than *authoritative*, and a "
     "verification that could not run says so in plain language."},
    {"t": "p", "text":
     "For a document about an auditing tool, this restraint is not decoration. The interface is where a reviewer "
     "decides whether to trust the system, and the design choices that build that trust are the same ones that "
     "make the system's output usable: show the evidence, name the uncertainty, distinguish failure from absence, "
     "and let the reviewer disagree with a specific step."},
]
