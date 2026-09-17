"""Multi-agent repository analysis (Tier 3, research feature 18).

Specialized analysts each inspect one slice of the repository with
deterministic evidence (no LLM required):

- ``security``     — severity-weighted findings from the latest scan
- ``quality``      — per-file code-health index
- ``churn``        — git hotspots, ownership and recent activity
- ``architecture`` — module import-graph smells
- ``dependencies`` — manifest dependencies actually imported / vulnerable
- ``tests``        — test presence for the files that need it most

Each agent returns a verdict (ok / attention / critical), a 0-10 score and the
*signals* it used, so the panel is inspectable. A consensus layer then finds
where agents agree: files with converging evidence (flagged by multiple
agents) and correlated signals — the classic multi-agent benefit of catching
things no single lens sees.
"""

from __future__ import annotations

from typing import Any


def _severity_weight(severity: str) -> float:
    return {"critical": 1.0, "high": 0.7, "medium": 0.4, "low": 0.15, "info": 0.05}.get(severity, 0.2)


def _verdict(score: float) -> str:
    if score >= 7:
        return "critical"
    if score >= 4:
        return "attention"
    return "ok"


def _security_agent(findings: list[dict[str, Any]]) -> dict[str, Any]:
    if not findings:
        return {
            "agent": "security",
            "verdict": "ok",
            "score": 0.0,
            "signals": ["Latest scan found no findings"],
            "confidence": 0.9,
        }
    criticals = sum(1 for f in findings if f.get("severity") == "critical")
    highs = sum(1 for f in findings if f.get("severity") == "high")
    if criticals:
        # a single verified critical issue is a critical signal regardless of counts
        score = min(10.0, round(7.5 + (criticals - 1) * 1.2 + highs * 0.2, 2))
    else:
        weighted = sum(_severity_weight(f.get("severity", "low")) for f in findings)
        score = min(10.0, round(weighted * 1.6, 2))
    by_sev: dict[str, int] = {}
    for f in findings:
        by_sev[f.get("severity", "info")] = by_sev.get(f.get("severity", "info"), 0) + 1
    sev_txt = ", ".join(f"{n} {k}" for k, n in sorted(by_sev.items()))
    signals = [
        f"{len(findings)} findings ({sev_txt})",
        f"{sum(1 for f in findings if f.get('status') == 'verified')} verified by evidence",
    ]
    top = sorted(findings, key=lambda f: _severity_weight(f.get("severity", "low")), reverse=True)
    if top:
        signals.append(f"worst: {top[0].get('title')} in {top[0].get('file_path')}")
    return {
        "agent": "security",
        "verdict": _verdict(score),
        "score": score,
        "signals": signals,
        "confidence": 0.85,
    }


def _quality_agent(health: dict[str, Any]) -> dict[str, Any]:
    avg = health.get("average_score")
    if avg is None:
        return {
            "agent": "quality",
            "verdict": "ok",
            "score": 0.0,
            "signals": ["No files scored"],
            "confidence": 0.8,
        }
    score = round(max(0.0, (7.0 - avg)) * 1.6, 2)
    worst = health.get("worst_files", [])[:3]
    signals = [f"average health {avg}/10 across {health.get('files_scored')} files"]
    if worst:
        signals.append("worst: " + ", ".join(worst))
    return {
        "agent": "quality",
        "verdict": _verdict(score),
        "score": min(10.0, score),
        "signals": signals,
        "confidence": 0.8,
    }


def _churn_agent(git: dict[str, Any]) -> dict[str, Any]:
    if not git.get("available"):
        return {
            "agent": "churn",
            "verdict": "ok",
            "score": 0.0,
            "signals": ["No git history (archive import)"],
            "confidence": 0.7,
        }
    files = git.get("files", [])
    hot = [f for f in files if f.get("hotspot_score", 0) >= 4]
    thin = [f for f in files if f.get("bus_factor", 1) <= 1.2]
    score = min(10.0, round(len(hot) * 0.8 + len(thin) * 0.3, 2))
    signals = [
        f"{git.get('commits_analyzed', 0)} commits analyzed",
        f"{len(hot)} hotspot file(s), {len(thin)} single-author file(s)",
    ]
    if hot:
        signals.append("hottest: " + hot[0]["path"])
    return {
        "agent": "churn",
        "verdict": _verdict(score),
        "score": score,
        "signals": signals,
        "confidence": 0.75,
    }


def _architecture_agent(smells: dict[str, Any]) -> dict[str, Any]:
    smell_list = smells.get("smells", [])
    if not smell_list:
        return {
            "agent": "architecture",
            "verdict": "ok",
            "score": 0.0,
            "signals": ["No architectural smells"],
            "confidence": 0.8,
        }
    weight = {"high": 1.0, "medium": 0.6, "low": 0.3}
    score = min(10.0, round(sum(weight.get(s["severity"], 0.3) for s in smell_list), 2))
    signals = [
        f"{len(smell_list)} smell(s): " + ", ".join(f"{s['smell']} ({s['severity']})" for s in smell_list[:4])
    ]
    return {
        "agent": "architecture",
        "verdict": _verdict(score),
        "score": score,
        "signals": signals,
        "confidence": 0.8,
    }


def _dependency_agent(deps: dict[str, Any]) -> dict[str, Any]:
    vuln = deps.get("vulnerable_reachable", 0)
    unreachable = deps.get("unreachable_count", 0)
    score = min(10.0, round(vuln * 2.5 + unreachable * 0.2, 2))
    signals = []
    if vuln:
        signals.append(f"{vuln} vulnerable and reachable dependencies")
    if unreachable:
        signals.append(f"{unreachable} declared dependencies never imported")
    if not signals:
        signals.append("no vulnerable or dead-weight dependencies")
    return {
        "agent": "dependencies",
        "verdict": _verdict(score),
        "score": score,
        "signals": signals,
        "confidence": 0.8,
    }


def _tests_agent(untested: list[str], tested: int) -> dict[str, Any]:
    if untested and not tested:
        score = min(10.0, round(len(untested) * 0.9, 2))
    else:
        ratio = len(untested) / max(1, len(untested) + tested)
        score = round(ratio * 10, 2)
    signals = [f"{len(untested)} changed/risky file(s) have no exercising test"]
    return {
        "agent": "tests",
        "verdict": _verdict(score),
        "score": score,
        "signals": signals[:3],
        "confidence": 0.75,
    }


def _correlate(agents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Files flagged by more than one agent (converging evidence)."""
    flagged: dict[str, list[str]] = {}
    for agent in agents:
        for f in agent.get("flagged_files", []):
            flagged.setdefault(f, []).append(agent["agent"])
    return [
        {"file": f, "agents": ags}
        for f, ags in sorted(flagged.items(), key=lambda kv: -len(kv[1]))
        if len(ags) >= 2
    ]


def run_multi_agent(
    *,
    findings: list[dict[str, Any]],
    health: dict[str, Any],
    git: dict[str, Any],
    smells: dict[str, Any],
    deps: dict[str, Any],
    flagged_by_quality: list[str],
    flagged_by_churn: list[str],
) -> dict[str, Any]:
    """Run all agents and produce the consensus view.

    ``flagged_by_quality`` / ``flagged_by_churn`` are per-file lists the
    caller derives from the health index and git analytics, so the consensus
    layer can flag files with converging evidence across lenses.
    """
    quality = _quality_agent(health)
    quality["flagged_files"] = flagged_by_quality[:8]
    churn = _churn_agent(git)
    churn["flagged_files"] = flagged_by_churn[:8]

    security = _security_agent(findings)
    security["flagged_files"] = sorted(
        {f.get("file_path") for f in findings if _severity_weight(f.get("severity", "low")) >= 0.4}
    )

    agents = [security, quality, churn, _architecture_agent(smells), _dependency_agent(deps)]
    correlations = _correlate(agents)

    # overall risk = weighted mean of agent scores (security weighted higher)
    weights = {"security": 2.0, "quality": 1.0, "churn": 0.8, "architecture": 0.8, "dependencies": 1.2}
    total_w = sum(weights.get(a["agent"], 1.0) for a in agents)
    overall = round(sum(a["score"] * weights.get(a["agent"], 1.0) for a in agents) / total_w, 2)
    criticals = [a for a in agents if a["verdict"] == "critical"]

    recommendations: list[str] = []
    if criticals:
        names = ", ".join(a["agent"] for a in criticals)
        recommendations.append(f"Critical signal from {names} — audit before merge.")
    if correlations:
        top = correlations[0]
        recommendations.append(
            f"{top['file']} is flagged by {len(top['agents'])} agents ({', '.join(top['agents'])}) — prioritize it."
        )
    if not correlations and not criticals:
        recommendations.append("No converging evidence — repository looks healthy across all lenses.")

    return {
        "agents": agents,
        "agent_count": len(agents),
        "overall_risk": overall,
        "overall_verdict": _verdict(overall),
        "converging_evidence": correlations,
        "recommendations": recommendations,
        "method": "deterministic consensus of specialized analysts",
    }
