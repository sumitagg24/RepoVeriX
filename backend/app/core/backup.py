"""Database backups.

``run_backup`` writes a consistent snapshot of the configured database into
``settings.backup_dir`` and prunes snapshots older than
``settings.backup_retention_days``.

- SQLite: online ``.backup`` API — safe to run while the app is live.
- PostgreSQL: ``pg_dump`` (custom format) when the binary is available.

Run it on a schedule with your job runner (``cron``/Task Scheduler/CI):

    python scripts/backup.py

Local dev (SQLite) and production (PostgreSQL) both work.
"""

from __future__ import annotations

import logging
import shutil
import sqlite3
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

_logger = logging.getLogger("repoverix.backup")


def _sqlite_path(database_url: str) -> Path | None:
    """Extract the filesystem path from a sqlite URL (or None)."""
    if not database_url.startswith("sqlite"):
        return None
    raw = database_url.split("://", 1)[-1]
    if raw in (":memory:", ":memory:"):
        return None
    # URL conventions: sqlite:///relative/path (extra slash = driver marker),
    # sqlite:////absolute/path (four slashes).
    if raw.startswith("//"):
        return Path(f"/{raw[2:]}")
    if raw.startswith("/"):
        return Path(raw[1:])
    if raw in ("", ":memory:"):
        return None
    return Path(raw)


def backup_sqlite(db_path: Path, dest_dir: Path, retention_days: int = 14) -> Path:
    """Online-backup ``db_path`` into ``dest_dir`` with retention pruning."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    dest = dest_dir / f"repoverix-{stamp}.db"

    source = sqlite3.connect(str(db_path))
    target = sqlite3.connect(str(dest))
    try:
        with target:
            source.backup(target)
        check = target.execute("PRAGMA quick_check").fetchone()[0]
        if check != "ok":
            raise RuntimeError(f"backup integrity check failed: {check}")
    finally:
        target.close()
        source.close()

    _prune(dest_dir, retention_days)
    _logger.info("sqlite backup written: %s", dest)
    return dest


def _prune(dest_dir: Path, retention_days: int) -> None:
    cutoff = datetime.now(UTC) - timedelta(days=max(retention_days, 1))
    for old in dest_dir.glob("repoverix-*.db"):
        try:
            mtime = datetime.fromtimestamp(old.stat().st_mtime, tz=UTC)
        except OSError:
            continue
        if mtime < cutoff:
            old.unlink(missing_ok=True)


def _dump_postgres(database_url: str, dest_dir: Path, retention_days: int) -> Path:
    if shutil.which("pg_dump") is None:
        raise RuntimeError(
            "PostgreSQL backup requires the pg_dump binary on PATH "
            "(install the PostgreSQL client tools on this host)"
        )
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    dest = dest_dir / f"repoverix-{stamp}.dump"

    # sqlalchemy URL: postgresql+asyncpg://user:pass@host:port/db
    url = database_url.replace("postgresql+asyncpg", "postgresql", 1)
    parsed = urlparse(url)
    env = dict(__import__("os").environ)
    if parsed.password:
        env["PGPASSWORD"] = parsed.password
    cmd = [
        "pg_dump",
        "-Fc",
        "--no-owner",
        "--host",
        parsed.hostname or "localhost",
        "--port",
        str(parsed.port or 5432),
        "--username",
        parsed.username or "repoverix",
        "--dbname",
        (parsed.path or "/repoverix").lstrip("/"),
        "-f",
        str(dest),
    ]
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        dest.unlink(missing_ok=True)
        raise RuntimeError(f"pg_dump failed: {(result.stderr or result.stdout)[-400:]}")
    _prune(dest_dir, retention_days)
    _logger.info("postgres backup written: %s", dest)
    return dest


def run_backup(dest_dir: str | None = None) -> Path:
    """Back up the configured database into ``dest_dir`` (default: settings)."""
    from app.core.config import get_settings

    settings = get_settings()
    target = Path(dest_dir or settings.backup_dir)
    db_path = _sqlite_path(settings.database_url)
    if db_path is not None:
        if not db_path.exists():
            raise RuntimeError(f"SQLite database not found at {db_path}")
        return backup_sqlite(db_path, target, settings.backup_retention_days)
    if settings.database_url.startswith(("postgres", "postgresql")):
        return _dump_postgres(settings.database_url, target, settings.backup_retention_days)
    raise RuntimeError(f"Unsupported database URL scheme: {settings.database_url}")


if __name__ == "__main__":  # pragma: no cover - thin CLI
    import argparse

    parser = argparse.ArgumentParser(description="Back up the RepoVeriX database")
    parser.add_argument("--dir", help="Destination directory (default: settings.backup_dir)")
    args = parser.parse_args()
    path = run_backup(args.dir)
    print(f"Backup written to {path}")
    sys.exit(0)
