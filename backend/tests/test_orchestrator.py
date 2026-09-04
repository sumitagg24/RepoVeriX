"""End-to-end tests for the scan orchestrator.

Each test ingests a ZIP of a deliberately vulnerable fixture repository and
runs the real pipeline (ingestion -> parsing -> static -> graph -> LLM ->
evidence validation) against an in-memory database, then asserts on the
persisted results.
"""

import io
import uuid
import zipfile
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.analysis.evidence import candidates_from_static, dedupe_static_findings
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.llm import MockProvider
from app.analysis.orchestrate import run_scan
from app.analysis.parsing import parse_source
from app.db.models import (
    AnalysisRun,
    Dependency,
    Evidence,
    File,
    Finding,
    FindingSource,
    FindingStatus,
    Repository,
    Scan,
    ScanConfiguration,
    ScanStatus,
    Severity,
    SourceType,
    Symbol,
    User,
)

FIXTURES = Path(__file__).parent / "fixtures" / "repos"


# --------------------------------------------------------------------------- helpers


def zip_from_dir(directory: Path, wrapper: str | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(directory.rglob("*")):
            if path.is_dir():
                continue
            rel = path.relative_to(directory).as_posix()
            arcname = f"{wrapper}/{rel}" if wrapper else rel
            zf.write(path, arcname)
    return buf.getvalue()


async def _seed_repo_scan(db_engine, repo_bytes: bytes, configuration: ScanConfiguration):
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        user = User(
            email=f"scan-{uuid.uuid4().hex[:8]}@test.local",
            hashed_password="x",
            full_name="Scan Test",
        )
        db.add(user)
        await db.flush()
        repo = Repository(
            owner_id=user.id,
            name="vulnerable-demo",
            source_type=SourceType.zip,
            status="registered",
        )
        db.add(repo)
        await db.flush()
        scan = Scan(
            repository_id=repo.id,
            configuration=configuration,
            status=ScanStatus.pending,
        )
        db.add(scan)
        await db.commit()
        repo_id, scan_id = repo.id, scan.id

    from app.analysis.ingest import store_archive

    store_archive(str(repo_id), repo_bytes)
    return factory, scan_id, repo_id


def _mock_provider_for(script: dict | None = None):
    return MockProvider(script=script)


async def _count(db, model):
    result = await db.execute(select(func.count(model.id)))
    return result.scalar() or 0


# --------------------------------------------------------------------------- tests


async def test_static_only_scan_python_repo(db_engine):
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, scan_id, _repo_id = await _seed_repo_scan(db_engine, zip_bytes, ScanConfiguration.static_only)
    await run_scan(factory, scan_id)

    async with factory() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == ScanStatus.completed
        assert scan.started_at is not None and scan.finished_at is not None
        assert scan.summary["configuration"] == "static_only"
        assert scan.summary["findings"]["total"] >= 4

        stages = {
            r.stage.value
            for r in (await db.execute(select(AnalysisRun).where(AnalysisRun.scan_id == scan_id))).scalars()
        }
        assert stages == {
            "ingestion",
            "parsing",
            "static_analysis",
            "knowledge_graph",
            "evidence_validation",
        }

        assert await _count(db, File) >= 4
        assert await _count(db, Symbol) >= 8
        assert await _count(db, Dependency) >= 2

        findings = list((await db.execute(select(Finding).where(Finding.scan_id == scan_id))).scalars())
        sqli = next(f for f in findings if f.title == "Potential SQL Injection")
        assert sqli.severity == Severity.critical
        assert sqli.status == FindingStatus.verified
        assert sqli.file_path == "app.py"
        assert sqli.line_start and sqli.line_start > 0
        assert sqli.source == FindingSource.static

        evidence = list((await db.execute(select(Evidence).where(Evidence.finding_id == sqli.id))).scalars())
        kinds = {e.kind.value for e in evidence}
        assert {"source_input", "transformation", "sink"} <= kinds

        titles = {f.title for f in findings}
        assert "Hardcoded Secret Detected" in titles
        assert "Potential Command Injection" in titles


async def test_llm_only_scan_with_mock(db_engine, monkeypatch):
    app_source = (FIXTURES / "vulnerable_app" / "app.py").read_text(encoding="utf-8")
    score_line = next(i + 1 for i, line in enumerate(app_source.splitlines()) if line.startswith("def score"))
    script = {
        "vulnerable-demo": {
            "findings": [
                {
                    "title": "Unsafe dynamic code execution",
                    "category": "security",
                    "severity": "high",
                    "file_path": "app.py",
                    "line_start": score_line,
                    "line_end": score_line,
                    "function_name": "score",
                    "claim": "eval() executes a caller-supplied expression",
                    "reasoning": f"score() calls eval(expression) directly on line {score_line}.",
                    "confidence": 0.9,
                    "requires_verification": True,
                }
            ]
        }
    }
    monkeypatch.setattr(
        "app.analysis.orchestrate.build_llm_provider",
        lambda s: _mock_provider_for(script),
    )
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, scan_id, _repo_id = await _seed_repo_scan(db_engine, zip_bytes, ScanConfiguration.llm_only)
    await run_scan(factory, scan_id)

    async with factory() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == ScanStatus.completed
        assert scan.llm_token_usage and scan.llm_token_usage["calls"] >= 1

        findings = list((await db.execute(select(Finding).where(Finding.scan_id == scan_id))).scalars())
        assert findings, "expected at least one LLM-grounded finding"
        for f in findings:
            assert f.source == FindingSource.llm
            assert f.status in (FindingStatus.verified, FindingStatus.probable)


async def test_repoverix_scan_with_mock(db_engine, monkeypatch):
    script = {
        "Potential SQL Injection": {
            "title": "Potential SQL Injection",
            "category": "security",
            "severity": "critical",
            "claim": "User-controlled name is interpolated into a SQL query",
            "reasoning": (
                "search_users builds an f-string containing the name "
                "and executes it via cursor.execute."
            ),
            "verdict": "confirmed",
            "confidence": 0.95,
            "requires_verification": True,
            "assumptions": [],
        }
    }
    monkeypatch.setattr(
        "app.analysis.orchestrate.build_llm_provider",
        lambda s: _mock_provider_for(script),
    )
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, scan_id, _repo_id = await _seed_repo_scan(db_engine, zip_bytes, ScanConfiguration.repoverix)
    await run_scan(factory, scan_id)

    async with factory() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == ScanStatus.completed
        assert scan.summary["llm"]["expected"] is True
        assert scan.llm_token_usage["calls"] >= 1
        assert scan.summary["findings"]["total"] >= 4

        findings = list((await db.execute(select(Finding).where(Finding.scan_id == scan_id))).scalars())
        sqli = next(f for f in findings if f.title == "Potential SQL Injection")
        assert sqli.status == FindingStatus.verified
        assert sqli.source == FindingSource.hybrid

        llm_nodes = list(
            (
                await db.execute(
                    select(Evidence).where(Evidence.finding_id == sqli.id, Evidence.kind == "llm_reasoning")
                )
            ).scalars()
        )
        assert llm_nodes, "expected an LLM-reasoning evidence node on the finding"


async def test_static_llm_without_provider_degrades_gracefully(db_engine):
    # Default settings: provider "openai" with no API key -> LLM stage unavailable
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, scan_id, _repo_id = await _seed_repo_scan(db_engine, zip_bytes, ScanConfiguration.static_llm)
    await run_scan(factory, scan_id)

    async with factory() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == ScanStatus.completed  # deterministic findings still produced
        runs = list(
            (
                await db.execute(
                    select(AnalysisRun).where(
                        AnalysisRun.scan_id == scan_id, AnalysisRun.stage == "llm_reasoning"
                    )
                )
            ).scalars()
        )
        assert runs and runs[0].status.value == "failed"
        assert "no provider key is configured" in (runs[0].output or {}).get("error", "")


async def test_javascript_scan(db_engine):
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_js", wrapper="demo-repo")
    factory, scan_id, _repo_id = await _seed_repo_scan(db_engine, zip_bytes, ScanConfiguration.static_only)
    await run_scan(factory, scan_id)

    async with factory() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == ScanStatus.completed
        findings = list((await db.execute(select(Finding).where(Finding.scan_id == scan_id))).scalars())
        titles = {f.title for f in findings}
        assert "Potential SQL Injection" in titles
        assert "Hardcoded Secret Detected" in titles
        assert "Potential Command Injection" in titles
        assert "Unsafe Dynamic Code Execution" in titles


def test_dedupe_and_candidate_construction():
    source = "def search(name):\n    q = f\"SELECT * FROM t WHERE x = '{name}'\"\n    cursor.execute(q)\n"
    pf = parse_source(source, "python", "app.py")
    findings = dedupe_static_findings(_builtin_findings(pf))
    assert findings, "expected builtin findings"
    graph = KnowledgeGraph([pf])
    candidates = candidates_from_static(findings, graph, {"app.py": pf})
    assert candidates
    sqli = next(c for c in candidates if "SQL" in c.title)
    assert sqli.line_start == 3
    assert sqli.function_name == "search"


def _builtin_findings(pf):
    from app.analysis.detectors import detect_all

    return detect_all(pf)


async def test_extract_archive_unwrap_and_rescan(db_engine):
    """A second scan over the same repo must run cleanly (source is re-extracted)."""
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, scan_id, _repo_id = await _seed_repo_scan(db_engine, zip_bytes, ScanConfiguration.static_only)
    # a second run over the same scan re-extracts the archive and completes cleanly,
    # de-duplicating findings by (scan, external_id)
    await run_scan(factory, scan_id)
    first_count = None
    async with factory() as db:
        first_count = (
            await db.execute(select(func.count(Finding.id)).where(Finding.scan_id == scan_id))
        ).scalar()
    await run_scan(factory, scan_id)

    async with factory() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == ScanStatus.completed
        assert scan.error is None
        assert scan.started_at == scan.started_at
        second_count = (
            await db.execute(select(func.count(Finding.id)).where(Finding.scan_id == scan_id))
        ).scalar()
        assert second_count == first_count
