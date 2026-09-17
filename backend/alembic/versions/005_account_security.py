"""Account security: account states, email verification, revocable sessions,
persistent lockout state, auth audit log and webhook idempotency ledger.

Revision ID: 005
Revises: 004
Create Date: 2026-09-07 00:00:00.000000

Existing users are grandfathered as email-verified (``email_verified_at =
created_at``) so the new verification gate only applies to accounts created
after this migration — no existing user can be locked out of their data.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None

USER_STATUS = postgresql.ENUM(
    "active",
    "email_unverified",
    "suspended",
    "deleted",
    name="user_status",
    create_type=True,
)


def upgrade() -> None:
    op.add_column("users", sa.Column("status", USER_STATUS, nullable=False, server_default="active"))
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("verification_token_hash", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("password_reset_token_hash", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True))

    # Grandfather every pre-existing account as verified.
    op.execute("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL")

    op.create_table(
        "auth_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("event", sa.String(length=40), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("detail", postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_events_user_created", "auth_events", ["user_id", "created_at"])
    op.create_index("ix_auth_events_email", "auth_events", ["email"])

    op.create_table(
        "processed_auth_webhooks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False, server_default="repoverix-local"),
        sa.Column("event_id", sa.String(length=128), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "event_id", name="uq_auth_webhook_provider_event"),
    )


def downgrade() -> None:
    op.drop_table("processed_auth_webhooks")
    op.drop_index("ix_auth_events_email", table_name="auth_events")
    op.drop_index("ix_auth_events_user_created", table_name="auth_events")
    op.drop_table("auth_events")
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token_hash")
    op.drop_column("users", "verification_expires_at")
    op.drop_column("users", "verification_token_hash")
    op.drop_column("users", "token_version")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "status")
    USER_STATUS.drop(op.get_bind(), checkfirst=True)
