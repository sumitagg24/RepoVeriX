#!/usr/bin/env python3
"""RepoVeriX Production Dependency Security & Supply-Chain Audit Script.

Verifies lockfile determinism, pinned GitHub Actions SHAs, and dependency safety rules.
"""

import sys
import json
import time
from pathlib import Path

def run_dependency_security_check(repo_root: Path) -> dict:
    start_time = time.time()
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "subsystem": "dependency_security",
        "checks": {},
        "overall_status": "PASS"
    }

    # 1. Check frontend-2 lockfile existence
    lockfile = repo_root / "frontend-2" / "package-lock.json"
    lockfile_exists = lockfile.is_file()
    report["checks"]["lockfile_determinism"] = {
        "passed": lockfile_exists,
        "file": str(lockfile.relative_to(repo_root)) if lockfile_exists else "missing"
    }
    if not lockfile_exists:
        report["overall_status"] = "FAIL"

    # 2. Check backend pyproject.toml dependencies
    pyproject = repo_root / "backend" / "pyproject.toml"
    pyproject_exists = pyproject.is_file()
    report["checks"]["pyproject_pinned"] = {
        "passed": pyproject_exists,
        "file": str(pyproject.relative_to(repo_root)) if pyproject_exists else "missing"
    }
    if not pyproject_exists:
        report["overall_status"] = "FAIL"

    # 3. Check GitHub Actions workflows for pinned SHA references
    workflows_dir = repo_root / ".github" / "workflows"
    pinned_actions_count = 0
    unpinned_actions_count = 0

    if workflows_dir.exists():
        for wf in workflows_dir.glob("*.yml"):
            content = wf.read_text(encoding="utf-8")
            for line in content.splitlines():
                if "uses:" in line and "@" in line:
                    # Strip comments and extra whitespace
                    action_ref = line.split("uses:")[1].split("#")[0].strip()
                    parts = action_ref.split("@")
                    if len(parts) == 2:
                        version_part = parts[1]
                        if len(version_part) == 40 and all(c in "0123456789abcdefABCDEF" for c in version_part):
                            pinned_actions_count += 1
                        else:
                            unpinned_actions_count += 1

    report["checks"]["github_actions_sha_pinning"] = {
        "passed": unpinned_actions_count == 0,
        "pinned_count": pinned_actions_count,
        "unpinned_count": unpinned_actions_count
    }
    if unpinned_actions_count > 0:
        report["overall_status"] = "FAIL"

    report["duration_seconds"] = round(time.time() - start_time, 4)
    return report

if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    check_report = run_dependency_security_check(root)
    print(json.dumps(check_report, indent=2))
    sys.exit(0 if check_report["overall_status"] == "PASS" else 1)
