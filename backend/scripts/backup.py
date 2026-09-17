"""Backup the RepoVeriX database.

Usage (from the ``backend`` directory):

    python scripts/backup.py [--dir ./data/backups]

Schedule it with cron / Task Scheduler / CI so the database is snapshotted
regularly. Snapshots older than ``REPOVERIX_BACKUP_RETENTION_DAYS`` (default
14) are pruned automatically.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.backup import run_backup  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Back up the RepoVeriX database")
    parser.add_argument("--dir", default=None, help="Destination directory (default: settings.backup_dir)")
    args = parser.parse_args()
    path = run_backup(args.dir)
    print(f"Backup written to {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
