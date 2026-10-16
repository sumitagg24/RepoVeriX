"""Rename Stripe subscription columns to Dodo Payments.

Revision ID: 009
Revises: 008
Create Date: 2026-10-16 00:00:00.000000

Dodo Payments replaces Stripe as the merchant of record. The columns are
renamed in place so any identifiers already stored survive; the index on the
customer id is dropped and recreated under the new name.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(op.f("ix_users_stripe_customer_id"), table_name="users")
    op.alter_column("users", "stripe_customer_id", new_column_name="dodo_customer_id")
    op.alter_column("users", "stripe_subscription_id", new_column_name="dodo_subscription_id")
    op.create_index(op.f("ix_users_dodo_customer_id"), "users", ["dodo_customer_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_dodo_customer_id"), table_name="users")
    op.alter_column("users", "dodo_customer_id", new_column_name="stripe_customer_id")
    op.alter_column("users", "dodo_subscription_id", new_column_name="stripe_subscription_id")
    op.create_index(op.f("ix_users_stripe_customer_id"), "users", ["stripe_customer_id"], unique=False)
