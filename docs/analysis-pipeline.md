# Analysis pipeline

The scan orchestrator (`backend/app/analysis/orchestrate.py`) runs a pipeline of
stages over one `Scan` row. Stages are tracked by `AnalysisRun` rows so
progress, timing, and failures are queryable and displayed in the UI.

## Stage 1 — Ingestion (`ingestion`)

- GitHub repos are shallow-cloned into an isolated per-repository directory
  (`REPOVERIX_REPOSITORY_STORAGE_DIR/<repo_id>/source`); the `.git` directory is
  removed afterwards.
- ZIP uploads are validated (magic bytes), stored, and extracted with
  path-traversal guards: absolute paths and `..` members are rejected, total
  size and per-file size limits are enforced (see `.env.example`).
- A single top-level folder wrapper (common in GitHub ZIP exports) is unwrapped.

## Stage 2 — Parsing (`parsing`, essential)

`parse_source(source, language, path)` uses **tree-sitter** to extract, per
supported language (Python, JavaScript, TypeScript):

- functions, methods, classes, decorated definitions
- imports (with relative-module resolution for `from . import x`)
- call sites (callee names + the enclosing function)

Results (`ParsedFile`) are persisted as `File` + `Symbol` rows (with file
foreign keys), and manifests are derived from `discovery.py` — languages,
package managers (`requirements.txt`, `pyproject.toml`, `package.json`...),
test detection (`pytest`/`unittest`/`jest`/...), dependencies. Parse failures
never abort the scan; they are recorded as warnings.

## Stage 3 — Static analysis (`static_analysis`)

- **Built-in deterministic detectors** (`detectors.py`) operate on parsed
  symbols/calls/source: dynamic SQL execution, hardcoded secrets, shell
  command injection (`shell=True` / `exec`), `eval`, weak hashes, broad
  exception swallowing, etc. Findings carry a stable rule id (e.g.
  `RVX-SQLI-001`, language variants `RVX-SQLI-JS-001`), severity, the exact
  sink location and structured evidence drafts.
- **External tools** (`tools.py`): ruff/bandit when available on the host, with
  capability detection. Missing tools degrade gracefully and are reported in
  the scan summary (`counts_by_tool`, `external_tool_runs`).

## Stage 4 — Knowledge graph (`knowledge_graph`)

`KnowledgeGraph` indexes files, symbols and calls. Static candidates are
enriched with **call-relationship evidence**: callers of the enclosing function
are looked up so that "if the caller passes untrusted input it reaches this
function" is recorded as evidence, not asserted by the LLM.

## Stage 5 — LLM reasoning (`llm_reasoning`)

The LLM never receives a whole repository or an unfiltered prompt built from
source:

1. **Context builder** (`context.py`) assembles a small package per candidate:
   the affected function window, caller/callee context from the graph, imports
   from/to the file, plus static evidence. Bounded by
   `REPOVERIX_LLM_MAX_CONTEXT_CHARS`.
2. **Secret redaction** (`redaction.py`) scrubs likely credentials from source
   before it reaches a provider.
3. **Prompts** are versioned files under `backend/prompts/`; the system prompt
   (`system_security_v1.txt`) treats repository content strictly as untrusted
   *data*. The model returns structured JSON (finding analysis, repo review, or
   repair).
4. Per-candidate failures (timeout, bad JSON, provider error) are recorded and
   the scan continues — one LLM failure never crashes an audit. A missing
   provider key fails the stage gracefully with a clear message, and
   deterministic findings still complete.

## Stage 6 — Evidence validation (`evidence_validation`)

`evidence.py` turns candidates + LLM assessment into persisted findings only
when evidence supports them:

- **Status rules**: `VERIFIED` (strong repository evidence, e.g. an input →
  concatenation → sink chain), `PROBABLE` (evidence suggests the issue but it
  cannot be fully established), `REJECTED` (insufficient evidence — not shown
  as confirmed vulnerabilities). LLM claims without grounding are rejected.
- Each persisted finding carries ordered `Evidence` rows
  (source/transformation/sink/call_relationship/static_analysis/llm_reasoning),
  plus severity, confidence (labeled as a model/system confidence score, not a
  calibrated probability), category, source (`static`/`llm`/`hybrid`) and
  exact location.
- Findings are de-duplicated on `(scan_id, external_id)` so re-running a scan
  over the same repo is idempotent.

## Failure handling

- `ingestion` and `parsing` failures abort the scan (`FAILED` with a readable
  `scan.error`); other stage failures are recorded per-run and degrade
  gracefully.
- Cancellation is cooperative: the UI can cancel a running scan and the
  orchestrator stops at the next stage boundary.

## Reproducibility

Every completed scan stores in `scan.summary.reproducibility`: analyzer
version, prompt version, LLM provider/model, tool versions, repository commit
when available, and a UTC timestamp. LLM call counts, token usage and
estimated cost are stored on `scan.llm_token_usage`.
