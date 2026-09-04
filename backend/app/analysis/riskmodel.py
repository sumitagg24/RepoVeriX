"""Predictive defect-risk modeling (Tier 3, research feature 22).

A small ridge-logistic-regression classifier — implemented in pure Python (no
numpy/sklearn dependency, ~60 lines of math) — that predicts which files in
the *next* scan are most likely to carry a verified finding.

Features per file (all deterministic evidence from the index):
  defect_risk lens score, maintainability lens, performance lens (health),
  churn, bug-fix commits, bus-factor thinness (git analytics),
  file size in lines, function/symbol count.

Labels: files with a verified finding in the latest completed scan.

Honest evaluation: leave-one-out over files (each file's prediction is made by
a model trained without it), reported as precision@k against the known labels
with an explicit in-sample caveat. Coefficients are returned so the model is
interpretable — the point is *which evidence predicts defects*, not a black box.
"""

from __future__ import annotations

import math
import random
from typing import Any

FEATURES = (
    "defect_risk",
    "maintainability",
    "performance",
    "churn",
    "bug_fixes",
    "bus_factor",
    "lines",
    "symbols",
)


def extract_features(
    health_files: list[dict[str, Any]],
    git_files: list[dict[str, Any]],
    flagged_paths: set[str],
    seed: int = 7,
) -> tuple[list[dict[str, Any]], list[float], list[str]]:
    """Join health + git per-file evidence into feature rows.

    Returns (rows, labels, paths). Label 1.0 when the file had a verified
    finding (``flagged_paths``).
    """
    git_by_path = {f.get("path"): f for f in git_files}
    rows: list[dict[str, Any]] = []
    labels: list[float] = []
    paths: list[str] = []

    for hf in health_files:
        path = hf.get("path", "")
        if not path:
            continue
        g = git_by_path.get(path, {})
        lenses = hf.get("lenses", {})
        rows.append(
            {
                "path": path,
                "defect_risk": float(lenses.get("defect_risk", 10.0) or 10.0),
                "maintainability": float(lenses.get("maintainability", 10.0) or 10.0),
                "performance": float(lenses.get("performance", 10.0) or 10.0),
                "churn": float(g.get("churn", 0.0) or 0.0),
                "bug_fixes": float(g.get("bug_fixes", 0) or 0),
                "bus_factor": float(g.get("bus_factor", 1.0) or 1.0),
                "lines": float(hf.get("lines", 0) or 0),
                "symbols": float(hf.get("symbols", 0) or 0),
            }
        )
        labels.append(1.0 if path in flagged_paths else 0.0)
        paths.append(path)

    rng = random.Random(seed)
    order = list(range(len(rows)))
    rng.shuffle(order)
    return [rows[i] for i in order], [labels[i] for i in order], [paths[i] for i in order]


def _standardize(matrix: list[list[float]]) -> tuple[list[list[float]], list[float], list[float]]:
    n = len(matrix)
    means = [sum(row[c] for row in matrix) / n for c in range(len(matrix[0]))]
    stds = []
    for c in range(len(matrix[0])):
        var = sum((row[c] - means[c]) ** 2 for row in matrix) / max(1, n - 1)
        stds.append(math.sqrt(var) if var > 1e-9 else 1.0)
    scaled = [[(row[c] - means[c]) / stds[c] for c in range(len(row))] for row in matrix]
    return scaled, means, stds


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def fit_logistic(
    X: list[list[float]], y: list[float], l2: float = 0.5, steps: int = 300, lr: float = 0.5
) -> list[float]:
    """Ridge logistic regression via batch gradient descent (intercept bias last)."""
    n, d = len(X), len(X[0])
    w = [0.0] * d
    for _ in range(steps):
        grads = [0.0] * d
        for i in range(n):
            p = _sigmoid(sum(w[c] * X[i][c] for c in range(d)))
            err = p - y[i]
            for c in range(d):
                grads[c] += err * X[i][c]
        for c in range(d):
            w[c] -= lr * ((grads[c] / n) + (l2 / n) * w[c])
    return w


def predict_proba(X: list[list[float]], w: list[float]) -> list[float]:
    return [_sigmoid(sum(w[c] * row[c] for c in range(len(row)))) for row in X]


def train_and_evaluate(
    rows: list[dict[str, Any]],
    labels: list[float],
    paths: list[str],
) -> dict[str, Any]:
    """Train the model and evaluate with leave-one-file-out precision@k."""
    feature_rows = [[row[f] for f in FEATURES] for row in rows]
    scaled, means, stds = _standardize(feature_rows)

    # full-data model for deployment predictions
    w_full = fit_logistic(scaled, labels)

    # leave-one-out evaluation: predict each file with a model trained on the rest
    loo_probs: list[float] = []
    n = len(rows)
    for i in range(n):
        train_idx = [j for j in range(n) if j != i]
        w = fit_logistic([scaled[j] for j in train_idx], [labels[j] for j in train_idx], steps=120)
        loo_probs.append(predict_proba([scaled[i]], w)[0])

    ranked = sorted(
        zip(loo_probs, paths, labels, rows, strict=True), key=lambda t: -t[0]
    )
    positives = sum(1 for y in labels if y > 0.5)

    # precision at k where k = max(1, positives) — did the model surface the risky files?
    k = max(1, min(positives or 1, n))
    top_k = ranked[:k]
    hits = sum(1 for _, _, y, _ in top_k if y > 0.5)
    precision_at_k = hits / k if k else 0.0

    predictions = [
        {"path": path, "predicted_risk": round(float(p), 4), "actual_finding": bool(y > 0.5)}
        for p, path, y, _ in ranked
    ]

    coefs = [{"feature": FEATURES[c], "weight": round((w_full[c] / stds[c]) * 10.0, 3)} for c in range(len(FEATURES))]
    coefs.sort(key=lambda c: -abs(c["weight"]))

    flagged_count = sum(1 for _, _, y, _ in top_k if y > 0.5)
    return {
        "samples": n,
        "positive_files": positives,
        "features": list(FEATURES),
        "coefficients": coefs,
        "predictions": predictions,
        "top_risk_files": [p["path"] for p in predictions[:10]],
        "evaluation": {
            "method": "leave-one-file-out",
            "precision_at_k": round(precision_at_k, 3),
            "k": k,
            "flagged_in_top_k": flagged_count,
            "caveat": "Small-sample estimate; treat as a ranking signal, not a verdict.",
        },
        "model": "ridge logistic regression (pure Python, L2)",
    }