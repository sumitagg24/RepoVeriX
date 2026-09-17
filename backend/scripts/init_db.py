#!/usr/bin/env python
"""Initialize the database by running migrations."""

import sys
from pathlib import Path

# Add the backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic.config import Config

from alembic import command
from app.core.config import get_settings


def run_migrations() -> None:
    """Run alembic migrations to head."""
    settings = get_settings()
    alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "head")
    print("Migrations applied successfully!")


if __name__ == "__main__":
    run_migrations()
