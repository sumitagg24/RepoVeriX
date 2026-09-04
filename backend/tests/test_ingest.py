"""Tests for ingestion security and project discovery."""

import io
import zipfile
from pathlib import Path

import pytest

from app.analysis.discovery import discover_project
from app.analysis.ingest import extract_archive, store_archive
from app.analysis.models import AnalysisError

FIXTURES = Path(__file__).parent / "fixtures" / "repos"


def _zip_bytes(members: list[tuple[str, bytes]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in members:
            zf.writestr(name, data)
    return buf.getvalue()


def test_extract_rejects_path_traversal(tmp_path):
    evil = _zip_bytes([("../evil.txt", b"pwned"), ("safe.txt", b"ok")])
    repo_id = "traversal-test"
    store_archive(repo_id, evil, storage_root=tmp_path)
    with pytest.raises(AnalysisError) as exc:
        extract_archive(repo_id, storage_root=tmp_path)
    assert exc.value.code == "unsafe_archive"
    assert not (tmp_path / "evil.txt").exists()


def test_extract_rejects_absolute_paths(tmp_path):
    evil = _zip_bytes([("/etc/passwd", b"pwned")])
    repo_id = "absolute-test"
    store_archive(repo_id, evil, storage_root=tmp_path)
    with pytest.raises(AnalysisError) as exc:
        extract_archive(repo_id, storage_root=tmp_path)
    assert exc.value.code == "unsafe_archive"


def test_extract_unwraps_single_root_folder(tmp_path):
    good = _zip_bytes(
        [
            ("repo-root/README.md", b"hi"),
            ("repo-root/app.py", b"print('hi')"),
        ]
    )
    repo_id = "wrap-test"
    store_archive(repo_id, good, storage_root=tmp_path)
    src = extract_archive(repo_id, storage_root=tmp_path)
    assert (src / "app.py").exists()
    assert not (src / "repo-root").exists()


def test_discover_python_project():
    root = FIXTURES / "vulnerable_app"
    manifest = discover_project(root, "directory")
    assert "python" in manifest.languages
    assert manifest.file_count >= 4
    assert manifest.has_tests
    assert "pytest" in manifest.test_frameworks
    names = {d["name"] for d in manifest.dependencies}
    assert "flask" in names
    assert "sqlalchemy" in names
    assert all(d["ecosystem"] in ("pypi", "npm") for d in manifest.dependencies)


def test_discover_javascript_project():
    root = FIXTURES / "vulnerable_js"
    manifest = discover_project(root, "directory")
    assert "javascript" in manifest.languages
    assert manifest.has_tests
    assert "jest" in manifest.test_frameworks
    names = {d["name"] for d in manifest.dependencies}
    assert "express" in names
    assert "jest" in names


def test_discover_no_tests_project_warns(tmp_path):
    (tmp_path / "main.py").write_text("x = 1\n", encoding="utf-8")
    manifest = discover_project(tmp_path, "directory")
    assert manifest.has_tests is False
    assert any("test suite" in w for w in manifest.warnings)
