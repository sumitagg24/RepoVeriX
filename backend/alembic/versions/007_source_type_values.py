"""Align source_type enum values with models.

Revision ID: 007
Revises: 4d3b145e76e1
Create Date: 2026-09-17

The ORM ``SourceType`` enum grew ``gitlab``, ``git`` and ``archive`` for the
generic git-clone ingestion path, but no migration added those labels to the
PostgreSQL enum type. SQLite development never noticed (no native enums).
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "007"
down_revision = "4d3b145e76e1"
branch_labels = None
depends_on = None

# Values present on the ORM ``SourceType`` enum. Existing databases created by
# earlier migrations only carry ``github`` and ``zip``.
_NEW_VALUES = ("gitlab", "git", "archive")


def upgrade() -> None:
    # ADDVALUE cannot run inside a transaction block on PostgreSQL.
    with op.get_context().autocommit_block():
        for value in _NEW_VALUES:
            op.execute(f"ALTER TYPE source_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # PostgreSQL cannot remove enum values; downgrade is a no-op.
    pass
