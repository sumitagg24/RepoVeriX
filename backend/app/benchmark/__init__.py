"""RepoVeriX-Bench: controlled evaluation of audit configurations.

Compares detection quality across the experimental configurations
(static_only / llm_only / static_llm / repoverix) on deliberately seeded
repositories against ground-truth defect lists. Metrics are computed only from
actual scan runs - never fabricated.

Usage (from the repo root):

    backend/.venv/Scripts/python -m app.benchmark run \
        --config bench/configs/experiments.json --out bench/reports
"""

__version__ = "0.1.0"
