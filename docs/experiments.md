# Experiments & RepoVeriX-Bench

RepoVeriX is also an experimental research system. Its question:

> Does combining repository-level context, deterministic static analysis, LLM
> reasoning, evidence validation and automated verification improve software
> defect detection and repair reliability compared with static-only or LLM-only
> approaches?

The architecture supports four audit configurations (see
`docs/architecture.md`) so the same repositories can be audited four ways and
compared.

## Framework

`backend/app/benchmark/` + `bench/` data:

```
bench/
  configs/experiments.json   repos x configurations + line tolerance
  ground_truth/              per-repo seeded defect lists (rule/file/function/line)
  reports/                   generated artifacts (JSON per experiment + summary.md)
backend/app/benchmark/
  metrics.py                 defect matching + precision/recall/F1/FP-rate
  experiments.py             orchestrator-backed runner
  __main__.py                CLI: python -m app.benchmark {run,list}
```

The seeded repositories (`backend/tests/fixtures/repos/`) are small, marked
**intentionally vulnerable**, use fake credentials, and cover Python and
JavaScript: SQL injection, hardcoded secrets, command injection, unsafe
`eval`, weak hashing, and a logic/reliability bug — each with a matching
ground-truth entry.

## Running

```bash
# from the repo root, with the backend venv
backend/.venv/Scripts/python -m app.benchmark list
backend/.venv/Scripts/python -m app.benchmark run \
    --config bench/configs/experiments.json --out bench/reports

# restrict scope, or use an explicit storage dir
... run --repos vulnerable_app --configs static_only repoverix
```

Each (repo × configuration) pair runs the **real orchestrator** against a
throwaway SQLite database and isolated repository storage, then scores the
findings against the ground truth. Artifacts:

- `bench/reports/<repo>__<config>.json` — findings, stage outcomes, LLM token
  usage, reproducibility metadata (analyzer/prompt/tool versions, timestamp).
- `bench/reports/summary.md` — the comparison table.

## Metrics

Defect-level, greedy one-to-one matching (findings ↔ ground-truth defects):

- a finding matches a defect when the file matches, the rule family matches
  (language variants `RVX-SQLI-001` vs `RVX-SQLI-JS-001` compare equal), and
  either the function or the location (line within tolerance) matches;
- `precision = TP/(TP+FP)`, `recall = TP/(TP+FN)`, `F1 = 2PR/(P+R)`,
  `false_positive_rate = FP/(TP+FP)`.

Ratios are `None` (rendered `TBD`) when the denominator is zero — **no numbers
are fabricated**, and summary tables are generated only from actual runs.

## Current status

Before any real experiments have been executed and published into
`bench/reports`, the expected comparison is:

| Configuration | Precision | Recall | F1 | False Pos. Rate | Patch Correctness | Verification Success |
|---|---:|---:|---:|---:|---:|---:|
| Static Only | TBD | TBD | TBD | TBD | N/A | N/A |
| LLM Only | TBD | TBD | TBD | TBD | TBD | TBD |
| Static + LLM | TBD | TBD | TBD | TBD | TBD | TBD |
| RepoVeriX | TBD | TBD | TBD | TBD | TBD | TBD |

LLM configurations require a provider key
(`REPOVERIX_OPENAI_API_KEY` / `REPOVERIX_ANTHROPIC_API_KEY` /
`REPOVERIX_GEMINI_API_KEY`). Without one, the LLM stage fails gracefully and is
recorded as failed — it never masquerades as an LLM result.

## Research questions / hypotheses map

- RQ1/H1 (context improves detection) → compare `llm_only` vs `repoverix`.
- RQ2/H1 (static + LLM > LLM only) → compare `llm_only` vs `static_llm`.
- RQ3/H2 (evidence validation reduces false positives) → compare raw LLM
  claims vs validated findings (rejected-candidate counts are recorded).
- RQ4/H4 (execution improves repairs) → verification success rate across
  template vs LLM patches on the seeded repositories.

## Extending the benchmark

Add a repository directory + a ground-truth JSON (same schema as existing
files) and register it in `bench/configs/experiments.json`. For repair
correctness measurements, mirror the `vulnerable_app` pattern: a
`fixed_app.py` reference implementation plus tests written so the vulnerable
version fails them.
