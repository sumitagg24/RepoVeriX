"""Scan-to-scan regression detection and finding deduplication.

Findings are identified by a **stable key** (``external_id`` = sha1 of
``rule|file|line``), so comparing two scans of the same repository answers the
questions reviewers actually ask:

- NEW: present in the later scan only
- RESOLVED: present in the earlier scan only
- STILL PRESENT: in both
- REINTRODUCED: was resolved between A->B, then came back in C

Dedup clusters group findings that fire on the same location from different
tools/rules (ruff + bandit + built-in on one line), keeping the highest-value
representative.
"""

from __future__ import annotations

from app.db.models import Finding


def _cluster_key(finding: Finding) -> tuple[str, int, str]:
    """Same file, same enclosing function (or ±3-line bucket), same category."""
    bucket = (finding.line_start or 0) // 3
    return (finding.file_path, bucket, finding.category.value)


def dedup_clusters(findings: list[Finding]) -> list[dict]:
    """Group findings hitting the same location; return cluster metadata."""
    groups: dict[tuple[str, int, str], list[Finding]] = {}
    for finding in findings:
        groups.setdefault(_cluster_key(finding), []).append(finding)

    clusters: list[dict] = []
    for members in groups.values():
        if len(members) == 1:
            continue
        primary = max(members, key=lambda f: (f.severity.value, f.confidence))
        clusters.append(
            {
                "file_path": primary.file_path,
                "line_start": primary.line_start,
                "size": len(members),
                "primary_finding_id": str(primary.id),
                "primary_title": primary.title,
                "primary_severity": primary.severity.value,
                "members": [
                    {
                        "id": str(m.id),
                        "title": m.title,
                        "rule": (m.evidence[0].extra or {}).get("rule") if m.evidence else None,
                        "severity": m.severity.value,
                        "status": m.status.value,
                    }
                    for m in sorted(members, key=lambda f: (-f.confidence, f.title))
                ],
            }
        )
    return sorted(clusters, key=lambda c: (-c["size"], c["file_path"]))


def compare_scans(
    before: list[Finding], after: list[Finding], *, earlier: list[Finding] | None = None
) -> dict:
    """Compare two scans' findings by stable external id."""
    before_ids = {f.external_id for f in before}
    after_ids = {f.external_id for f in after}
    before_map = {f.external_id: f for f in before}
    after_map = {f.external_id: f for f in after}

    resolved = sorted(before_ids - after_ids)
    new = sorted(after_ids - before_ids)
    still_present = sorted(before_ids & after_ids)

    changed_status = []
    changed_severity = []
    confidence_deltas = []
    for key in still_present:
        prev, curr = before_map[key], after_map[key]
        if prev.status != curr.status:
            changed_status.append(
                {
                    "external_id": key,
                    "title": curr.title,
                    "file_path": curr.file_path,
                    "status_before": prev.status.value,
                    "status_after": curr.status.value,
                }
            )
        if prev.severity != curr.severity:
            changed_severity.append(
                {
                    "external_id": key,
                    "title": curr.title,
                    "file_path": curr.file_path,
                    "severity_before": prev.severity.value,
                    "severity_after": curr.severity.value,
                }
            )
        if abs(prev.confidence - curr.confidence) >= 0.1:
            confidence_deltas.append(
                {
                    "external_id": key,
                    "title": curr.title,
                    "file_path": curr.file_path,
                    "confidence_before": prev.confidence,
                    "confidence_after": curr.confidence,
                }
            )

    # reintroduced: resolved between `earlier -> before`, present again in `after`
    reintroduced: list[str] = []
    if earlier is not None:
        earlier_ids = {f.external_id for f in earlier}
        resolved_in_before = earlier_ids - before_ids
        reintroduced = sorted(after_ids & resolved_in_before)

    return {
        "total_before": len(before),
        "total_after": len(after),
        "new": new,
        "resolved": resolved,
        "still_present": still_present,
        "reintroduced": reintroduced,
        "changed_status": changed_status,
        "changed_severity": changed_severity,
        "confidence_deltas": confidence_deltas[:20],
    }