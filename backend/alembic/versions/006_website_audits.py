"""Website audits: user-registered public websites + passive audit runs.

Revision ID: 006
Revises: 005
Create Date: 2026-09-17 00:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "websites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("hostname", sa.String(length=253), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("last_audit_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_websites_owner_id", "websites", ["owner_id"])
    op.create_index("ix_websites_hostname", "websites", ["hostname"])

    op.create_table(
        "website_audits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("website_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("max_pages", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("max_depth", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("pages_crawled", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("scores", postgresql.JSONB(), nullable=True),
        sa.Column("summary", postgresql.JSONB(), nullable=True),
        sa.Column("pages", postgresql.JSONB(), nullable=True),
        sa.Column("findings", postgresql.JSONB(), nullable=True),
        sa.Column("evidence", postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["website_id"], ["websites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_website_audits_website_id", "website_audits", ["website_id"])
    op.create_index("ix_website_audits_website_created", "website_audits", ["website_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_website_audits_website_created", table_name="website_audits")
    op.drop_index("ix_website_audits_website_id", table_name="website_audits")
    op.drop_table("website_audits")
    op.drop_index("ix_websites_hostname", table_name="websites")
    op.drop_index("ix_websites_owner_id", table_name="websites")
    op.drop_table("websites")
