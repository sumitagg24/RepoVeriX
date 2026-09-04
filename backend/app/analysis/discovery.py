"""Repository discovery: walk files, detect languages/dependencies/tests.

Treats repository content as untrusted data: enforces size limits, skips
ignored directories, and never follows symlinks out of the repository root.
"""

from __future__ import annotations

import hashlib
import os
import re
import tomllib
from pathlib import Path

from app.analysis.models import AnalysisError, ProjectManifest, RepoFile
from app.core.config import get_settings

# Extension -> language
LANGUAGE_BY_EXT: dict[str, str] = {
    ".py": "python",
    ".pyi": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
}

SUPPORTED_LANGUAGES = {"python", "javascript", "typescript"}

IGNORED_DIR_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    ".github",
    ".gitlab",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".next",
    ".nuxt",
    ".cache",
    ".yarn",
    ".venv",
    ".terraform",
    "node_modules",
    "venv",
    "env",
    "__pycache__",
    "dist",
    "build",
    "coverage",
    "htmlcov",
    ".eggs",
    "eggs",
    ".serverless",
    ".turbo",
    "target",
}

IGNORED_FILE_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".so",
    ".dll",
    ".dylib",
    ".exe",
    ".class",
    ".o",
    ".a",
    ".min.js",
    ".map",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".lockb",
    ".whl",
    ".jar",
    ".war",
    ".egg",
}

TEST_FILE_RE = re.compile(
    r"(^|/)(test_[^/]+\.py|.*_test\.py|tests?\.py|"
    r".*\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$|"
    r".*[-_.](test|spec)\.(py)$|"
    r"(^|/)(test|tests|__tests__|spec|specs)/)"
)

# --------------------------------------------------------------------------- walking


def _looks_like_source(name: str) -> bool:
    if name == ".env":
        return False  # never treat local env files as source to analyze
    for suffix in IGNORED_FILE_SUFFIXES:
        if name.endswith(suffix):
            return False
    return True


def walk_repo_files(root: Path) -> tuple[list[Path], int]:
    """Walk ``root`` returning (files, ignored_count) honouring ignore rules and limits."""
    settings = get_settings()
    max_bytes = settings.max_repo_size_mb * 1024 * 1024
    max_file_bytes = settings.max_file_size_kb * 1024
    max_files = settings.max_files

    files: list[Path] = []
    ignored = 0
    total = 0
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d not in IGNORED_DIR_NAMES)
        for filename in sorted(filenames):
            if not _looks_like_source(filename):
                ignored += 1
                continue
            full = Path(dirpath) / filename
            try:
                size = full.stat().st_size
            except OSError:
                ignored += 1
                continue
            if size > max_file_bytes:
                ignored += 1
                continue
            total += size
            files.append(full)
            if len(files) >= max_files:
                raise AnalysisError(
                    f"Repository exceeds the limit of {max_files} source files",
                    code="repo_too_large",
                )
    if total > max_bytes:
        raise AnalysisError(
            f"Repository exceeds the {settings.max_repo_size_mb}MB size limit",
            code="repo_too_large",
        )
    return files, ignored


def describe_file(root: Path, full: Path) -> RepoFile:
    rel = full.relative_to(root).as_posix()
    data = full.read_bytes()
    return RepoFile(
        path=rel,
        language=LANGUAGE_BY_EXT.get(full.suffix.lower()),
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        is_test=bool(TEST_FILE_RE.search(rel)),
    )


def read_text_file(root: Path, rel_path: str, max_chars: int | None = None) -> str:
    """Read a repository file as text with an optional guard for giant files."""
    full = root / rel_path
    if max_chars:
        raw = full.read_bytes()[:max_chars]
        return raw.decode("utf-8", errors="replace")
    return full.read_text(encoding="utf-8", errors="replace")


# --------------------------------------------------------------------------- dependency & test discovery


def _parse_requirements(text: str) -> list[tuple[str, str | None]]:
    out: list[tuple[str, str | None]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "-", "--")):
            continue
        parts = re.split(r"[<>=!~;]", line, maxsplit=1)
        name = parts[0].strip().replace("_", "-")
        if not name:
            continue
        version: str | None = None
        m = re.search(r"(==|~=|>=|<=)([A-Za-z0-9.\-]+)", line)
        if m:
            version = m.group(2)
        out.append((name, version))
    return out


def _parse_pyproject(text: str) -> list[tuple[str, str | None, bool]]:
    """Parse [project] / [tool.poetry] dependencies from a pyproject.toml."""
    out: list[tuple[str, str | None, bool]] = []
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError:
        return out
    project = data.get("project") or {}
    for spec in project.get("dependencies", []):
        if isinstance(spec, str):
            name = re.split(r"[<>=!~;\[\]]", spec)[0].strip()
            if name:
                out.append((name, None, False))
    for group in (project.get("optional-dependencies") or {}).values():
        for spec in group:
            if isinstance(spec, str):
                name = re.split(r"[<>=!~;\[\]]", spec)[0].strip()
                if name:
                    out.append((name, None, False))
    poetry = (data.get("tool") or {}).get("poetry") or {}
    for name, spec in (poetry.get("dependencies") or {}).items():
        if name.lower() == "python":
            continue
        if isinstance(spec, str):
            out.append((name, None, False))
        elif isinstance(spec, dict):
            out.append((name, spec.get("version"), bool(spec.get("optional"))))
    return out


def _parse_package_json(text: str) -> list[tuple[str, str | None, bool]]:
    out: list[tuple[str, str | None, bool]] = []
    try:
        import json

        data = json.loads(text)
    except (ValueError, TypeError):
        return out
    for section, is_dev in (("dependencies", False), ("devDependencies", True)):
        for name, ver in (data.get(section) or {}).items():
            version = re.sub(r"^[\^~>=< ]+", "", str(ver)) if isinstance(ver, str) else None
            out.append((name, version, is_dev))
    return out


def discover_project(root: Path, source: str, prewalked: list[Path] | None = None) -> ProjectManifest:
    """Detect languages, package managers, dependencies and tests in ``root``.

    ``prewalked`` may be supplied to avoid walking the tree twice when the
    caller already enumerated files.
    """
    manifest = ProjectManifest(source=source)
    settings = get_settings()

    files, ignored = (prewalked, 0) if prewalked is not None else walk_repo_files(root)
    manifest.ignored_file_count = ignored

    # languages by extension
    counts: dict[str, int] = {}
    sizes: dict[str, int] = {}
    total_bytes = 0
    for full in files:
        rel = full.relative_to(root).as_posix()
        ext = full.suffix.lower()
        lang = LANGUAGE_BY_EXT.get(ext)
        if lang:
            counts[lang] = counts.get(lang, 0) + 1
        try:
            size = full.stat().st_size
        except OSError:
            size = 0
        sizes[ext] = sizes.get(ext, 0) + 1
        total_bytes += size

    manifest.language_counts = counts
    manifest.languages = [lang for lang in ("python", "typescript", "javascript") if counts.get(lang)]
    manifest.file_count = len(files)
    manifest.total_size_bytes = total_bytes

    # git metadata
    git_dir = root / ".git"
    if git_dir.exists():
        head_file = root / ".git" / "HEAD"
        try:
            head = head_file.read_text(encoding="utf-8", errors="replace").strip()
            if head.startswith("ref: "):
                manifest.git_branch = head[5:].replace("refs/heads/", "")
        except OSError:
            pass

    # dependencies / package managers / tests
    pm_by_path: dict[str, tuple[str, str]] = {}
    candidates: dict[tuple[str, str, bool], str] = {}
    test_frameworks: set[str] = set()
    test_command: str | None = None
    test_files = 0

    for full in files:
        rel = full.relative_to(root).as_posix()
        name = full.name
        if TEST_FILE_RE.search(rel):
            test_files += 1
        try:
            text = full.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        if name == "requirements.txt":
            pm_by_path.setdefault(rel, ("pip", "requirements.txt"))
            for dep, version in _parse_requirements(text):
                candidates.setdefault((dep.lower(), version or "", False), name)
        elif name == "pyproject.toml":
            pm_by_path.setdefault(rel, ("pip", "pyproject.toml"))
            for dep, version, is_dev in _parse_pyproject(text):
                candidates.setdefault((dep.lower(), version or "", is_dev), name)
        elif name == "package.json":
            pm_by_path.setdefault(rel, ("npm", "package.json"))
            for dep, version, is_dev in _parse_package_json(text):
                candidates.setdefault((dep.lower(), version or "", is_dev), name)
            # npm test script
            try:
                import json

                pkg = json.loads(text)
            except ValueError:
                pkg = {}
            scripts = pkg.get("scripts") or {}
            if "test" in scripts:
                test_command = scripts["test"]
        elif name in (
            "Pipfile",
            "Pipfile.lock",
            "poetry.lock",
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
        ):
            manifest.lockfiles.append(rel)

    # Detect test frameworks from config + lock files presence
    rel_set = {f.relative_to(root).as_posix() for f in files}
    if "pyproject.toml" in rel_set:
        try:
            text = (root / "pyproject.toml").read_text(encoding="utf-8", errors="replace")
            if "[tool.pytest" in text:
                test_frameworks.add("pytest")
            if "[tool.poetry]" in text:
                pass
        except OSError:
            pass
    if (
        "pytest.ini" in rel_set
        or "conftest.py" in rel_set
        or any(p == "tests" or p.startswith("tests/") for p in rel_set)
    ):
        test_frameworks.add("pytest")
    if "package.json" in rel_set:
        try:
            import json

            pkg = json.loads((root / "package.json").read_text(encoding="utf-8", errors="replace"))
            dev = pkg.get("devDependencies") or {}
            for framework in ("jest", "vitest", "mocha"):
                if framework in dev or framework in (pkg.get("dependencies") or {}):
                    test_frameworks.add(framework)
        except (ValueError, OSError):
            pass

    if test_frameworks:
        manifest.test_frameworks = sorted(test_frameworks)
        manifest.has_tests = True
    manifest.test_file_count = test_files
    if test_command is None and manifest.has_tests:
        if "pytest" in manifest.test_frameworks or "unittest" in manifest.test_frameworks:
            test_command = "pytest -q" if "pytest" in manifest.test_frameworks else "python -m unittest"
        elif manifest.test_frameworks:
            test_command = "npm test"
    manifest.test_command = test_command
    manifest.package_managers = [pm for pm, _ in sorted(pm_by_path.values())]

    # dependencies (deduplicated across manifests)
    ecosystem_by_source = {
        "requirements.txt": "pypi",
        "pyproject.toml": "pypi",
        "package.json": "npm",
    }
    seen_deps: set[tuple[str, str, str, bool]] = set()
    for full in files:
        if full.name not in ecosystem_by_source:
            continue
        eco = ecosystem_by_source[full.name]
        try:
            text = full.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if full.name == "requirements.txt":
            parsed = [(d, v, False) for d, v in _parse_requirements(text)]
        elif full.name == "pyproject.toml":
            parsed = _parse_pyproject(text)
        else:
            parsed = _parse_package_json(text)
        for name, version, is_dev in parsed:
            key = (eco, name.lower(), version or "", is_dev)
            if key in seen_deps:
                continue
            seen_deps.add(key)
            manifest.dependencies.append(
                {"ecosystem": eco, "name": name, "version": version, "is_dev": is_dev}
            )
    manifest.dependencies.sort(key=lambda d: (d["ecosystem"], d["name"]))

    if not manifest.languages:
        manifest.warnings.append("No supported source languages detected (python/javascript/typescript).")
    if not test_frameworks and test_files == 0:
        manifest.warnings.append("No automated test suite detected.")

    _ = settings
    return manifest
