"""Self-improving rule / prompt selection (Tier 3, research feature 19).

Every finding the pipeline produces is a *training example*: verified findings
confirm a detector rule or prompt strategy worked; rejected findings are false
positives. This module closes the loop:

- ``rule_stats`` — per-detector-rule precision over completed scans
  (verified / rejected / probable, patch attempts, verified repairs).
- ``recommend_strategy`` — decide which detector-rule profile and which LLM
  evidence-context strategy to use next. With little history it *explores*
  (defaults, marked ``exploring``); once enough samples exist it *exploits*
  the strategy with the best observed precision. Rules whose false-positive
  rate exceeds a threshold are de-weighted for the next scan.

All learning signals are deterministic counts from the database — no LLM
required to improve the pipeline.
"""

from __future__ import annotations

from typing import Any

_MIN_SAMPLES = 3  # findings per rule before the selector trusts its stats
_FP_MAX = 0.4  # rejected share above which a rule is de-weighted
_CONTEXT_STRATEGIES = ("lean", "standard", "rich")


def compute_rule_stats(
    scan_results: list[dict[str, Any]],
    patch_results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Aggregate per-rule outcomes across completed scans.

    ``scan_results``: [{"rule", "status"(verified/probable/rejected),
                        "severity", "external_id"}]
    ``patch_results``: [{"rule", "patch_count", "verified_repairs"}]
    """
    per_rule: dict[str, dict[str, Any]] = {}
    for f in scan_results:
        rule = f.get("rule") or "unknown"
        row = per_rule.setdefault(
            rule,
            {"rule": rule, "total": 0, "verified": 0, "probable": 0, "rejected": 0, "patches": 0, "verified_repairs": 0},
        )
        row["total"] += 1
        status = f.get("status")
        if status in ("verified", "probable", "rejected"):
            row[status] += 1

    for p in patch_results:
        rule = p.get("rule") or "unknown"
        row = per_rule.setdefault(
            rule,
            {"rule": rule, "total": 0, "verified": 0, "probable": 0, "rejected": 0, "patches": 0, "verified_repairs": 0},
        )
        row["patches"] += int(p.get("patch_count", 0))
        row["verified_repairs"] += int(p.get("verified_repairs", 0))

    rows = []
    for row in per_rule.values():
        total = max(1, row["total"])
        row["precision"] = round(row["verified"] / total, 3)
        row["false_positive_rate"] = round(row["rejected"] / total, 3)
        rows.append(row)
    rows.sort(key=lambda r: (-r["precision"], -r["total"]))
    return {"rule_count": len(rows), "rules": rows}


def recommend_strategy(rule_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Choose the next-scan detector profile + LLM context strategy.

    Explores with defaults until a rule has enough samples; then exploits:
    rules with high verified-rate keep (or increase) weight, high-FP rules are
    de-weighted, and the LLM evidence-context strategy with the best observed
    finding precision is preferred.
    """
    trusted = [r for r in rule_rows if r["total"] >= _MIN_SAMPLES]
    exploring = not trusted

    profile = {}
    for r in rule_rows:
        weight = 1.0
        if r["total"] >= _MIN_SAMPLES:
            weight = round(min(1.5, max(0.25, r["precision"] * 1.5)), 2)
            if r["false_positive_rate"] > _FP_MAX:
                weight = round(weight * 0.5, 2)
        profile[r["rule"]] = weight

    # strategy precision: verified findings vs probable+rejected per strategy
    # (the caller feeds finding provenance; absent it, prefer "standard")
    strategy_score: dict[str, float] = {}
    for strat in _CONTEXT_STRATEGIES:
        strategy_score[strat] = 0.0
    for r in rule_rows:
        strategy = r.get("strategy") or "standard"
        strategy_score[strategy] = strategy_score.get(strategy, 0.0) + r.get("precision", 0.5) * r["total"]

    chosen = max(strategy_score.items(), key=lambda kv: kv[1])[0]
    deweighted = [r["rule"] for r in rule_rows if r["false_positive_rate"] > _FP_MAX and r["total"] >= _MIN_SAMPLES]

    return {
        "exploring": exploring,
        "mode": "exploring (defaults, insufficient history)" if exploring else "exploiting (history-driven)",
        "recommended_context_strategy": chosen,
        "rule_profile": dict(sorted(profile.items(), key=lambda kv: -kv[1])),
        "deweighted_rules": deweighted,
        "sample_total": sum(r["total"] for r in rule_rows),
        "strategy_scores": strategy_score,
    }


def apply_recommendation_to_config(profile: dict[str, float], settings: Any) -> dict[str, Any]:
    """Render the recommended rule profile as a configuration diff (0-10 weights).

    Kept separate so a future orchestrator run can consume the recommendation
    without importing this module's internals.
    """
    return {
        "rule_weights": {k: round(min(10.0, v * 6.0), 2) for k, v in profile.items()},
        "source": "self-improvement",
    }