"""Supply chain and build integrity tests for RepoVeriX.

Covers:
- Lockfile existence and consistency (frontend-2/package-lock.json)
- Secret exposure boundary (no sensitive NEXT_PUBLIC_* variables)
- Production source maps disabled in next.config.mjs
- CI/CD least privilege permissions
"""

from __future__ import annotations

import json
import re
from pathlib import Path


def _find_repo_root() -> Path:
    current = Path(__file__).resolve().parent
    while current.parent != current:
        if (current / "frontend-2").is_dir() and (current / "backend").is_dir():
            return current
        current = current.parent
    raise RuntimeError("Could not find repository root")


def test_frontend_lockfile_exists_and_matches():
    """frontend-2/package-lock.json must exist and contain dependencies declared in package.json."""
    root = _find_repo_root()
    pkg_json_path = root / "frontend-2" / "package.json"
    lock_json_path = root / "frontend-2" / "package-lock.json"

    assert pkg_json_path.exists(), "frontend-2/package.json must exist"
    assert lock_json_path.exists(), "frontend-2/package-lock.json must exist for deterministic builds"

    pkg_data = json.loads(pkg_json_path.read_text(encoding="utf-8"))
    lock_data = json.loads(lock_json_path.read_text(encoding="utf-8"))

    assert lock_data.get("lockfileVersion") in {
        2,
        3,
    }, "Lockfile version must be modern npm format (v2 or v3)"

    deps = pkg_data.get("dependencies", {})
    packages = lock_data.get("packages", {})

    # Root package entry in packages[""] or direct resolution must contain declared dependencies
    root_lock_entry = packages.get("", {})
    lock_deps = root_lock_entry.get("dependencies", {})
    for dep in deps:
        assert dep in lock_deps or f"node_modules/{dep}" in packages, (
            f"Dependency {dep} in package.json must be resolved in lockfile"
        )


def test_no_sensitive_next_public_env_vars():
    """Client-accessible NEXT_PUBLIC_* environment variables must never expose credentials."""
    root = _find_repo_root()
    frontend_dir = root / "frontend-2" / "src"

    forbidden_patterns = [
        re.compile(
            r"NEXT_PUBLIC_.*(?:SECRET|KEY|PASSWORD|TOKEN|AUTH_SECRET|PRIVATE|CREDENTIAL)",
            re.IGNORECASE,
        ),
    ]

    # Safe allowlist for standard public URL / origin keys
    safe_allowlist = {
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_API_ORIGIN",
        "NEXT_PUBLIC_SITE_URL",
    }

    found_public_vars: set[str] = set()
    for file_path in frontend_dir.rglob("*.ts*"):
        text = file_path.read_text(encoding="utf-8", errors="replace")
        for match in re.finditer(r"\bNEXT_PUBLIC_[A-Z0-9_]+\b", text):
            var_name = match.group(0)
            found_public_vars.add(var_name)
            if var_name not in safe_allowlist:
                for pattern in forbidden_patterns:
                    assert not pattern.search(var_name), (
                        f"Potentially sensitive client env var {var_name} found in {file_path.name}"
                    )


def test_next_config_disables_production_source_maps():
    """frontend-2/next.config.mjs must explicitly disable production source maps."""
    root = _find_repo_root()
    config_path = root / "frontend-2" / "next.config.mjs"
    assert config_path.exists()
    content = config_path.read_text(encoding="utf-8")
    assert "productionBrowserSourceMaps: false" in content, (
        "productionBrowserSourceMaps: false must be explicitly set in next.config.mjs"
    )


def test_github_actions_least_privilege_permissions():
    """All workflow files must explicitly declare least-privilege permissions."""
    root = _find_repo_root()
    workflows_dir = root / ".github" / "workflows"
    assert workflows_dir.is_dir()

    for wf_file in workflows_dir.glob("*.yml"):
        content = wf_file.read_text(encoding="utf-8")
        assert "permissions:" in content, f"Workflow {wf_file.name} must declare explicit permissions"
