# RepoVeriX-Bench reports

This directory receives experiment results produced by the runner:

```bash
# from the repository root (use the backend virtualenv's python)
backend/.venv/Scripts/python -m app.benchmark run \
    --config bench/configs/experiments.json --out bench/reports
```

What gets written per run:

- `summary.md` — one table row per (repository × configuration) with
  precision / recall / F1 / false-positive-rate.
- `<repository>__<configuration>.json` — full per-experiment artifact: findings,
  stage-by-stage outcomes, LLM token usage, scan summary and reproducibility
  metadata (analyzer/prompt/tool versions, timestamp).

Rules of the road (see `docs/experiments.md`):

- **Nothing in this directory is fabricated.** Metrics are computed from actual
  orchestrator runs against the ground-truth defect lists in
  `bench/ground_truth/`.
- Configurations that need an LLM provider run without one will record the LLM
  stage as failed (graceful degradation) and will **not** silently masquerade as
  LLM results — re-run them with `REPOVERIX_OPENAI_API_KEY` /
  `REPOVERIX_ANTHROPIC_API_KEY` / `REPOVERIX_GEMINI_API_KEY` set.
- Cells without data render as `TBD`.
