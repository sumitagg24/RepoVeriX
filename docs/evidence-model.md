# Evidence model

The design separates three things that other tools blur:

1. what the **LLM claims**,
2. what **repository/static evidence** supports,
3. what **execution** has verified.

A persisted `Finding` row is the outcome of evidence validation, not of an LLM
prompt. The audit UI renders the evidence chain for every finding so a reviewer
can judge *why* a defect was reported.

## Evidence kinds

Evidence rows (`Evidence` model, ordered by `order_index`) form the chain from
source to sink:

| Kind | Meaning |
|---|---|
| `source_input` | untrusted input reaches the code (route param, request field) |
| `transformation` | data is transformed (string concatenation, f-string build) |
| `sink` | the dangerous operation (SQL `execute`, `exec`, `eval`) |
| `call_relationship` | a caller (possibly passing untrusted data) invokes the enclosing function |
| `static_analysis` | deterministic tool result (built-in rule or ruff/bandit) |
| `dependency` | a dependency-related risk |
| `test` | test evidence for the location |
| `llm_reasoning` | the model's structured reasoning (never a verdict on its own) |

Each node records file/line/snippet/description and structured `metadata`
(e.g. `rule`, caller/callee identifiers) — a chain is data, not prose.

## Candidate → finding flow

```
static tool result or repo-review claim
        ↓
candidate (StaticFinding + KnowledgeGraph enrichment)
        ↓
context package (file/function/callers/callees/static evidence)
        ↓
LLM structured assessment
        ↓
evidence validation (finalize_candidate)
        ↓
Finding (status + evidence rows)   |   REJECTED candidates recorded, not stored
```

`evidence.py` keeps the rules deterministic: the LLM assessment can change
confidence and add reasoning nodes, but the *minimum required evidence* (sink
located, chain plausible) is checked in code.

## Status semantics

- `VERIFIED` — strong repository evidence supports the finding (source path +
  transformation + sink or equivalent grounded chain).
- `PROBABLE` — evidence suggests the issue but it cannot be fully established.
- `REJECTED` — not enough evidence; reported as rejected rather than hidden, so
  the audit trail is honest. The dashboard separates these counts.

Confidence is a **system confidence score** (0–1) used to rank findings; the UI
labels it as such and it is not presented as calibrated probability.

## The LLM is never the validator

Even in `llm_only` configuration, raw claims must survive grounding/validation
to become findings. And nothing claimed about *repair* counts until the
verification engine has executed the patch — see `docs/verification.md`.
