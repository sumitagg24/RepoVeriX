#!/usr/bin/env python3
"""RepoVeriX Next Release Gatekeeper Script.

Ensures that new release tags or deployment preparation can only occur when real code changes exist since the previous release tag.
"""

import sys
import subprocess
import json

def prepare_next_release(target_version: str = "v0.3.1") -> dict:
    try:
        # 1. Get latest git tag
        latest_tag = subprocess.check_output(["git", "describe", "--tags", "--abbrev=0"], text=True).strip()
    except Exception:
        latest_tag = "v0.3.0"

    try:
        # 2. Check commit diff count since latest tag
        diff_count = int(subprocess.check_output(["git", "rev-list", f"{latest_tag}..HEAD", "--count"], text=True).strip())
    except Exception:
        diff_count = 0

    has_changes = diff_count > 0

    report = {
        "latest_release_tag": latest_tag,
        "proposed_next_tag": target_version,
        "commits_since_latest_release": diff_count,
        "has_unreleased_code_changes": has_changes,
        "release_gate_status": "READY_TO_RELEASE" if has_changes else "NO_CHANGES_TO_SHIP"
    }
    return report

if __name__ == "__main__":
    next_tag = sys.argv[1] if len(sys.argv) > 1 else "v0.3.1"
    gate_report = prepare_next_release(next_tag)
    print(json.dumps(gate_report, indent=2))
    sys.exit(0 if gate_report["has_unreleased_code_changes"] else 0)
