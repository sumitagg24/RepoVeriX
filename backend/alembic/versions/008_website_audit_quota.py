"""Website audit quota: per-plan monthly budget for passive website audits.

Revision ID: 008
Revises: 007
Create Date: 2026-09-17 00:00:00.000000

Adds ``users.website_audits_used`` (monthly counter, rolled over with the
other billing counters). Portable INTEGER column: runs on PostgreSQL and on
the SQLite dev/test path.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("website_audits_used", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "website_audits_used")
