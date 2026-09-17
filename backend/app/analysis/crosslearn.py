"""Cross-repository learning (Tier 3, research feature 20).

Learns from *all* of a user's scanned repositories at once. Instead of asking
an LLM to generalize, we mine the evidence that already exists:

- which defect patterns recur across repositories (rule × language),
- which rule pairs co-occur inside repositories (correlated root causes),
- which file roles are repeatedly risky (auth handlers, db helpers, …),
- and a transfer suggestion: when a rule keeps verifying in one repository,
  which *other* repositories likely carry the same pattern.

Everything is deterministic counts over the user's own scans — a private
per-account knowledge base.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

_RISKY_STEM_RE = re.compile(
    r"(auth|login|user|session|upload|parse|import|exec|db|sql|query|token|key|config|handler|route)",
    re.IGNORECASE,
)


def _stem(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    return name.rsplit(".", 1)[0].lower()


def learn_patterns(repos: list[dict[str, Any]]) -> dict[str, Any]:
    """Learn patterns from per-repo summaries.

    ``repos``: [{"name", "languages", "findings": [{rule, category, severity,
    status, file_path, function_name}], "verified_rate": float}]
    """
    rule_lang: Counter[tuple[str, str]] = Counter()
    rule_status: dict[str, list[str]] = defaultdict(list)
    category_lang: Counter[tuple[str, str]] = Counter()
    stem_hits: Counter[tuple[str, str]] = Counter()  # (stem, category)
    rule_pairs: Counter[tuple[str, str]] = Counter()
    repo_rule: dict[str, set[str]] = defaultdict(set)
    repos_with_verified: list[dict[str, Any]] = []

    for repo in repos:
        langs = (repo.get("languages") or [])[:1]
        lang = langs[0] if langs else "unknown"
        rules_in_repo: set[str] = set()
        verified_here = False
        for f in repo.get("findings", []):
            rule = f.get("rule") or f.get("external_id") or "unknown"
            cat = f.get("category") or "unknown"
            status = f.get("status") or "unknown"
            rule_lang[(rule, lang)] += 1
            category_lang[(cat, lang)] += 1
            rule_status[rule].append(status)
            stem_hits[(_stem(f.get("file_path", "")), cat)] += 1
            rules_in_repo.add(rule)
            if status == "verified":
                verified_here = True
        if verified_here:
            repos_with_verified.append(repo["name"])
        for r in sorted(rules_in_repo):
            repo_rule[r].add(repo["name"])
        rule_list = sorted(rules_in_repo)
        for i in range(len(rule_list)):
            for j in range(i + 1, len(rule_list)):
                rule_pairs[(rule_list[i], rule_list[j])] += 1

    top_patterns = [
        {"rule": r, "language": lang, "occurrences": n} for (r, lang), n in rule_lang.most_common(12)
    ]
    top_categories = [
        {"category": cat, "language": lang, "findings": n} for (cat, lang), n in category_lang.most_common(8)
    ]
    top_stems = [
        {"file_role": stem, "category": cat, "hits": n}
        for (stem, cat), n in stem_hits.most_common(10)
        if _RISKY_STEM_RE.search(stem) or n >= 2
    ]
    co_occurrence = [{"rules": [a, b], "repositories": n} for (a, b), n in rule_pairs.most_common(10)]

    # transfer suggestions: rules verified in >= 2 repos with candidates that
    # have NOT (yet) recorded that rule
    transfer: list[dict[str, Any]] = []
    all_repos = {r["name"] for r in repos}
    for rule, repo_names in sorted(repo_rule.items(), key=lambda kv: -len(kv[1])):
        if len(repo_names) >= 2:
            candidates = sorted(all_repos - repo_names)[:3]
            if candidates:
                transfer.append({"rule": rule, "verified_in": sorted(repo_names), "check_also": candidates})

    total_findings = sum(len(r.get("findings", [])) for r in repos)
    return {
        "repositories_analyzed": len(repos),
        "total_findings": total_findings,
        "recurring_patterns": top_patterns,
        "category_distribution": top_categories,
        "risky_file_roles": top_stems,
        "rule_co_occurrence": co_occurrence,
        "transfer_suggestions": transfer,
        "repositories_with_verified_findings": repos_with_verified[:20],
        "method": "deterministic aggregation across the account's scans",
    }
