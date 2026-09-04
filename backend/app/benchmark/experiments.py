"""Experiment execution for RepoVeriX-Bench.

Each (repository x configuration) pair is scanned end-to-end against its own
throwaway SQLite database using the real orchestrator, then scored against the
repository's ground-truth defect list. Results (with full reproducibility
metadata) are written as JSON per experiment plus a Markdown summary table.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import tempfile
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.benchmark import __version__
from app.benchmark.metrics import compute_metrics, load_ground_truth
from app.db.base import Base
from app.db.models import (
    AnalysisRun,
    Finding,
    Repository,
    Scan,
    ScanConfiguration,
    ScanStatus,
    SourceType,
    User,
)


def _zip_from_dir(directory: Path, wrapper: str | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(directory.rglob("*")):
            if path.is_dir():
                continue
            rel = path.relative_to(directory).as_posix()
            zf.write(path, f"{wrapper}/{rel}" if wrapper else rel)
    return buf.getvalue()


def _finding_dict(finding: Finding) -> dict:
    from app.analysis.repair import finding_rule

    return {
        "file_path": finding.file_path,
        "function_name": finding.function_name,
        "line_start": finding.line_start,
        "line_end": finding.line_end,
        "title": finding.title,
        "severity": finding.severity.value,
        "status": finding.status.value,
        "source": finding.source.value,
        "rule": finding_rule(finding),
        "external_id": finding.external_id,
        "evidence": [
            {
                "kind": ev.kind.value,
                "description": ev.description,
                "extra": ev.extra,
            }
            for ev in finding.evidence
        ],
    }


async def run_experiment(
    repo_dir: Path,
    configuration: ScanConfiguration,
    *,
    db_path: Path,
    repo_name: str = "repo",
    repo_bytes: bytes | None = None,
) -> dict:
    """Scan one repository under one configuration; returns a full result dict.

    ``REPOVERIX_REPOSITORY_STORAGE_DIR`` must be configured before the first
    ``get_settings()`` call of the process (settings are cached); the runner
    sets it once in ``run_all`` / CLI.
    """
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path.as_posix()}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as db:
            user = User(
                email=f"bench-{uuid.uuid4().hex[:12]}@repoverix.local",
                hashed_password="bench",
                full_name="Bench Runner",
            )
            db.add(user)
            await db.flush()
            repo = Repository(
                owner_id=user.id,
                name=repo_name,
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
            repo_id, scan_id = str(repo.id), scan.id

        from app.analysis.ingest import store_archive
        from app.analysis.orchestrate import run_scan

        payload = repo_bytes or _zip_from_dir(repo_dir, wrapper="bench")
        store_archive(repo_id, payload)
        await run_scan(factory, scan_id)

        async with factory() as db:
            scan = await db.get(Scan, scan_id)
            assert scan is not None
            findings = list(
                (
                    await db.execute(
                        select(Finding)
                        .options(selectinload(Finding.evidence))
                        .where(Finding.scan_id == scan_id)
                    )
                ).scalars()
            )
            runs = list(
                (await db.execute(select(AnalysisRun).where(AnalysisRun.scan_id == scan_id))).scalars()
            )
            return {
                "repository": repo_name,
                "configuration": configuration.value,
                "scan_status": scan.status.value,
                "scan_error": scan.error,
                "duration_seconds": _seconds_between(scan.started_at, scan.finished_at),
                "findings": [_finding_dict(f) for f in findings],
                "stage_runs": [
                    {
                        "stage": r.stage.value,
                        "status": r.status.value,
                        "tool": r.tool_name,
                        "error": (r.output or {}).get("error"),
                        "output": r.output,
                    }
                    for r in runs
                ],
                "llm_usage": scan.llm_token_usage,
                "summary": scan.summary,
            }
    finally:
        await engine.dispose()


def _seconds_between(start, end) -> float | None:
    if not start or not end:
        return None
    return round((end - start).total_seconds(), 3)


def load_experiment_config(config_path: Path) -> dict:
    with open(config_path, encoding="utf-8") as fh:
        return json.load(fh)


def _resolve(path_str: str, root: Path) -> Path:
    path = Path(path_str)
    return path if path.is_absolute() else (root / path)


async def run_all(
    config_path: Path,
    out_dir: Path,
    *,
    root: Path,
    only_repos: list[str] | None = None,
    only_configs: list[str] | None = None,
) -> list[dict]:
    """Run the configured experiments and write JSON + Markdown reports."""
    config = load_experiment_config(config_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    workspace = Path(tempfile.mkdtemp(prefix="repoverix-bench-"))
    storage = workspace / "storage"
    storage.mkdir(parents=True, exist_ok=True)
    # settings are cached per process: point repository storage at the isolated
    # workspace before the first get_settings() call inside run_scan
    os.environ["REPOVERIX_REPOSITORY_STORAGE_DIR"] = str(storage)

    for repo_cfg in config.get("repositories", []):
        name = repo_cfg["name"]
        if only_repos and name not in only_repos:
            continue
        repo_dir = _resolve(repo_cfg["path"], root)
        ground_truth = load_ground_truth(_resolve(repo_cfg["ground_truth"], root))
        repo_work = workspace / name
        repo_work.mkdir(parents=True, exist_ok=True)
        for config_name in config.get("configurations", []):
            if only_configs and config_name not in only_configs:
                continue
            try:
                outcome = await run_experiment(
                    repo_dir,
                    ScanConfiguration(config_name),
                    db_path=repo_work / f"{config_name}.db",
                    repo_name=name,
                )
            except Exception as exc:  # pragma: no cover - recorded, never silent
                outcome = {
                    "repository": name,
                    "configuration": config_name,
                    "scan_status": "failed",
                    "scan_error": f"{type(exc).__name__}: {exc}",
                    "findings": [],
                    "stage_runs": [],
                }
            metrics = compute_metrics(
                outcome.get("findings", []), ground_truth, line_tolerance=config.get("line_tolerance", 6)
            )
            outcome["ground_truth"] = {"path": repo_cfg["ground_truth"], "defects": len(ground_truth)}
            outcome["metrics"] = metrics
            outcome["reproducibility"] = {
                "bench_version": __version__,
                "timestamp_utc": datetime.now(UTC).isoformat(),
                "analyzer": (outcome.get("summary") or {}).get("reproducibility"),
            }
            results.append(outcome)
            _write_json(out_dir / f"{name}__{config_name}.json", outcome)

    _write_summary(results, out_dir)
    shutil.rmtree(workspace, ignore_errors=True)
    return results


def _write_json(path: Path, payload: dict) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, default=str)


def _write_summary(results: list[dict], out_dir: Path) -> None:
    header = (
        "# RepoVeriX-Bench Experiment Results\n\n"
        "Generated from actual orchestrator runs; empty cells mean the metric "
        "had no data (represented as `TBD` until experiments are run with the "
        "intended configurations). No numbers here are fabricated.\n\n"
    )
    rows = [
        "| Repository | Configuration | Precision | Recall | F1 | False Pos. Rate | Findings | Defects | LLM calls | LLM cost (USD) |",  # noqa: E501
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in sorted(results, key=lambda x: (x["repository"], x["configuration"])):
        m = r.get("metrics") or {}
        usage = r.get("llm_usage") or {}
        row = (
            f"| {r['repository']} | {r['configuration']} "
            f"| {_fmt(m.get('precision'))} | {_fmt(m.get('recall'))} | {_fmt(m.get('f1'))} "
            f"| {_fmt(m.get('false_positive_rate'))} "
            f"| {m.get('reported_findings', 0)} | {m.get('ground_truth_defects', 0)} "
            f"| {usage.get('calls') if usage else 'n/a'} "
            f"| {usage.get('estimated_cost_usd') if usage else 'n/a'} |"
        )
        rows.append(row)
    note = (
        "\n## Reproducibility\n\n"
        "Per-experiment JSON files in this directory include scan summaries with "
        "analyzer/prompt/tool versions, LLM token usage and stage-by-stage "
        "outcomes (including graceful LLM failures when no provider key is set).\n"
    )
    with open(out_dir / "summary.md", "w", encoding="utf-8") as fh:
        fh.write(header + "\n".join(rows) + note)


def _fmt(value) -> str:
    if value is None:
        return "TBD"
    return f"{value:.4f}" if isinstance(value, float) else str(value)
