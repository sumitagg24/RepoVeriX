"""Scan-to-scan regression detection and finding deduplication.

Findings are first matched by their **stable external id** (sha1 of
``rule|file|line``). A second, evidence-based pass re-matches leftovers by
``(category, rule, enclosing function)`` so that *moved or shifted code* that
preserves the same defect is still reported as STILL PRESENT (or
SEVERITY_CHANGED) instead of a spurious NEW + RESOLVED pair — the match is
only made when the rule, category and symbol line up.

Comparing two scans answers the questions reviewers actually ask:

- NEW: present in the later scan only
- RESOLVED: present in the earlier scan only
- STILL PRESENT: in both (incl. moved/shifted matches)
- REINTRODUCED: was resolved between A->B, then came back in C
- SEVERITY_CHANGED / STATUS_CHANGED: same defect, different label

Dedup clusters group findings that fire on the same location from different
tools/rules, keeping the highest-value representative.
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


def _rule_of(finding: Finding) -> str | None:
    """Detector rule from the evidence metadata (``rule`` key) if recorded."""
    for ev in finding.evidence:
        extra = ev.extra or {}
        rule = extra.get("rule")
        if isinstance(rule, str) and rule:
            return rule
    return None


def _anchor(finding: Finding) -> tuple[str, str | None, str | None]:
    """Evidence-based move anchor: (category, rule, enclosing function name)."""
    func = (finding.function_name or "").split("::")[-1] or None
    return (finding.category.value, _rule_of(finding), func)


def _snapshot(finding: Finding, *, full: bool) -> dict:
    """Compact row usable in comparison tables / UI filters."""
    evidence = []
    if full:
        evidence = [
            {
                "kind": ev.kind.value,
                "file_path": ev.file_path,
                "line_start": ev.line_start,
                "snippet": ev.snippet,
                "description": ev.description[:300],
            }
            for ev in finding.evidence[:6]
        ]
    return {
        "external_id": finding.external_id,
        "title": finding.title,
        "category": finding.category.value,
        "severity": finding.severity.value,
        "status": finding.status.value,
        "confidence": round(finding.confidence, 3),
        "file_path": finding.file_path,
        "line_start": finding.line_start,
        "line_end": finding.line_end,
        "function_name": finding.function_name,
        "rule": _rule_of(finding),
        "source": finding.source.value,
        "evidence": evidence,
    }


def _pair_moved(before: list[Finding], after: list[Finding]) -> list[tuple[Finding, Finding]]:
    """Evidence-based re-match of leftovers whose code moved or shifted.

    Groups leftovers by (category, rule, enclosing function). Within a group
    pairs are assigned by file equality first, then nearest line distance, so
    a relocated function with the same defect is recognised without inventing
    relationships between unrelated findings.
    """
    groups_before: dict[tuple, list[Finding]] = {}
    groups_after: dict[tuple, list[Finding]] = {}
    for f in before:
        key = _anchor(f)
        if key[1] is not None:  # a rule anchor is required — no guessing
            groups_before.setdefault(key, []).append(f)
    for f in after:
        key = _anchor(f)
        if key[1] is not None:
            groups_after.setdefault(key, []).append(f)

    pairs: list[tuple[Finding, Finding]] = []
    for key, after_members in groups_after.items():
        before_members = groups_before.pop(key, [])
        if not before_members:
            continue
        remaining: list[Finding] = []
        for a_f in after_members:
            if not before_members:
                remaining.append(a_f)
                continue
            same_file = [b for b in before_members if b.file_path == a_f.file_path]
            candidates = same_file or before_members
            best = min(
                candidates,
                key=lambda b: (
                    0 if b.file_path == a_f.file_path else 1,
                    abs((b.line_start or 0) - (a_f.line_start or 0)),
                ),
            )
            pairs.append((best, a_f))
            before_members.remove(best)
        after_members = remaining
    return pairs


def compare_scans(
    before: list[Finding], after: list[Finding], *, earlier: list[Finding] | None = None
) -> dict:
    """Compare two scans' findings; returns state lists, row details, summary.

    Pass 1 matches exact external ids. Pass 2 re-matches leftovers whose
    code moved but whose (category, rule, function) anchor still lines up,
    so moved code is reported as STILL PRESENT rather than NEW+RESOLVED.
    """
    before_map = {f.external_id: f for f in before}
    after_map = {f.external_id: f for f in after}
    still_ids = sorted(set(before_map) & set(after_map))
    leftover_before = [f for f in before if f.external_id not in after_map]
    leftover_after = [f for f in after if f.external_id not in before_map]

    moved_pairs = _pair_moved(leftover_before, leftover_after)
    moved_after_ids = {a.external_id for _b, a in moved_pairs}
    still_ids.extend(sorted({a.external_id for _b, a in moved_pairs}))
    new_ids = sorted(f.external_id for f in leftover_after if f.external_id not in moved_after_ids)
    moved_before_ids = {b.external_id for b, _a in moved_pairs}
    resolved_ids = sorted(
        f.external_id for f in leftover_before if f.external_id not in moved_before_ids
    )

    pairs: dict[str, tuple[Finding, Finding]] = {}
    for key in still_ids:
        if key in before_map and key in after_map:
            pairs[key] = (before_map[key], after_map[key])
    pairs.update({a.external_id: (b, a) for b, a in moved_pairs})

    changed_status: list[dict] = []
    changed_severity: list[dict] = []
    confidence_deltas: list[dict] = []
    moved_rows: list[dict] = []
    for key, (prev, curr) in pairs.items():
        moved = key in moved_after_ids
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
        if moved:
            moved_rows.append(
                {
                    "external_id": key,
                    "title": curr.title,
                    "file_path": curr.file_path,
                    "line_before": prev.line_start,
                    "line_after": curr.line_start,
                    "reason": (
                        "same rule and enclosing function after the code moved"
                        if prev.file_path == curr.file_path
                        else "same rule and function relocated to another file"
                    ),
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
        earlier_map = {f.external_id: f for f in earlier}
        earlier_after = [
            f
            for f in after
            if f.external_id not in before_map and f.external_id not in moved_after_ids
        ]
        reintroduced = sorted(
            f.external_id
            for f in earlier_after
            if f.external_id in earlier_map
            and (f.external_id in set(new_ids))
        )

    def by_id(ids: list[str]) -> dict[str, Finding]:
        lookup = {**before_map, **after_map}
        return {k: lookup[k] for k in ids if k in lookup}

    after_lookup = by_id(new_ids + still_ids + reintroduced + resolved_ids)

    def item(external_id: str, state: str, full: bool = False) -> dict:
        f = after_lookup[external_id]
        row = _snapshot(f, full=full)
        row["state"] = state
        if external_id in pairs and full:
            prev, _curr = pairs[external_id]
            row["before"] = _snapshot(prev, full=True)
        return row

    severity_ids = {c["external_id"] for c in changed_severity}
    items: list[dict] = []
    items += [item(k, "still_present") for k in sorted(set(still_ids) - severity_ids)]
    items += [item(k, "severity_changed", full=True) for k in sorted(severity_ids)]
    items += [item(k, "resolved", full=True) for k in resolved_ids]
    items += [item(k, "new", full=True) for k in new_ids]
    items += [item(k, "reintroduced", full=True) for k in reintroduced]
    items.sort(key=lambda it: (it["file_path"], it["line_start"] or 0))

    counts = {
        "new": len(new_ids),
        "resolved": len(resolved_ids),
        "still_present": len(set(still_ids) - set(reintroduced)),
        "reintroduced": len(reintroduced),
        "severity_changed": len(severity_ids),
        "status_changed": len(changed_status),
    }

    return {
        "total_before": len(before),
        "total_after": len(after),
        "summary": counts,
        "new": new_ids,
        "resolved": resolved_ids,
        "still_present": sorted(set(still_ids) - set(reintroduced)),
        "reintroduced": reintroduced,
        "changed_status": changed_status,
        "changed_severity": changed_severity,
        "moved": moved_rows,
        "confidence_deltas": confidence_deltas[:20],
        "items": items,
    }