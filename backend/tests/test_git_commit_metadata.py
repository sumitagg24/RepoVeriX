"""The scan summary must record the exact commit that was analysed."""

import subprocess
from pathlib import Path

from app.analysis.discovery import discover_project


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
        check=True,
        env={
            "GIT_AUTHOR_NAME": "t",
            "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "t",
            "GIT_COMMITTER_EMAIL": "t@example.com",
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "HOME": str(repo),
        },
    ).stdout.strip()


def test_discover_project_records_git_commit(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    (repo / "app.py").write_text("def f():\n    return 1\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "initial")
    expected = _git(repo, "rev-parse", "HEAD")

    manifest = discover_project(repo, "git")
    assert manifest.git_branch == "main"
    assert manifest.git_commit == expected, (manifest.git_commit, expected)


def test_discover_project_records_packed_ref_commit(tmp_path):
    """A deepened clone repacks the refs — packed-refs must be read too."""
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    (repo / "app.py").write_text("def f():\n    return 1\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "initial")
    expected = _git(repo, "rev-parse", "HEAD")
    _git(repo, "pack-refs", "--all")

    assert not (repo / ".git" / "refs" / "heads" / "main").exists()
    manifest = discover_project(repo, "git")
    assert manifest.git_commit == expected


def test_discover_project_without_git_has_no_commit(tmp_path):
    plain = tmp_path / "plain"
    plain.mkdir()
    (plain / "app.py").write_text("x = 1\n")
    manifest = discover_project(plain, "zip")
    assert manifest.git_commit is None
    assert manifest.git_branch is None
