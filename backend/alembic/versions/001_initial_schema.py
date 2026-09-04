"""Initial schema for RepoVeriX.

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    source_type = postgresql.ENUM("github", "zip", name="source_type", create_type=False)
    scan_status = postgresql.ENUM("pending", "running", "completed", "failed", name="scan_status", create_type=False)
    scan_configuration = postgresql.ENUM("static_only", "llm_only", "static_llm", "repoverix", name="scan_configuration", create_type=False)
    analysis_stage = postgresql.ENUM("ingestion", "parsing", "static_analysis", "knowledge_graph", "llm_reasoning", "evidence_validation", "repair", "verification", name="analysis_stage", create_type=False)
    run_status = postgresql.ENUM("pending", "running", "completed", "failed", name="run_status", create_type=False)
    symbol_kind = postgresql.ENUM("function", "class", "method", "variable", "import", name="symbol_kind", create_type=False)
    ecosystem = postgresql.ENUM("pypi", "npm", name="ecosystem", create_type=False)
    finding_category = postgresql.ENUM("security", "logic", "api_misuse", "database", "dependency", "reliability", name="finding_category", create_type=False)
    severity = postgresql.ENUM("critical", "high", "medium", "low", "info", name="severity", create_type=False)
    finding_status = postgresql.ENUM("verified", "probable", "rejected", name="finding_status", create_type=False)
    finding_source = postgresql.ENUM("static", "llm", "hybrid", name="finding_source", create_type=False)
    evidence_kind = postgresql.ENUM("source_input", "transformation", "sink", "static_analysis", "dependency", "test", "llm_reasoning", "call_relationship", name="evidence_kind", create_type=False)
    patch_status = postgresql.ENUM("candidate", "applied", "verified", "failed", "not_verified", name="patch_status", create_type=False)
    verification_status = postgresql.ENUM("pending", "running", "verified_repair", "repair_failed", "repair_not_verified", name="verification_status", create_type=False)
    test_outcome = postgresql.ENUM("passed", "failed", "error", "skipped", name="test_outcome", create_type=False)

    # Create enums
    source_type.create(op.get_bind(), checkfirst=True)
    scan_status.create(op.get_bind(), checkfirst=True)
    scan_configuration.create(op.get_bind(), checkfirst=True)
    analysis_stage.create(op.get_bind(), checkfirst=True)
    run_status.create(op.get_bind(), checkfirst=True)
    symbol_kind.create(op.get_bind(), checkfirst=True)
    ecosystem.create(op.get_bind(), checkfirst=True)
    finding_category.create(op.get_bind(), checkfirst=True)
    severity.create(op.get_bind(), checkfirst=True)
    finding_status.create(op.get_bind(), checkfirst=True)
    finding_source.create(op.get_bind(), checkfirst=True)
    evidence_kind.create(op.get_bind(), checkfirst=True)
    patch_status.create(op.get_bind(), checkfirst=True)
    verification_status.create(op.get_bind(), checkfirst=True)
    test_outcome.create(op.get_bind(), checkfirst=True)

    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(320), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Repositories table
    op.create_table(
        "repositories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("source_type", source_type, nullable=False),
        sa.Column("source_url", sa.String(2048)),
        sa.Column("default_branch", sa.String(200), default="main", nullable=False),
        sa.Column("storage_path", sa.String(1024)),
        sa.Column("primary_languages", postgresql.JSONB(), default=list, nullable=False),
        sa.Column("status", sa.String(50), default="registered", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Scans table
    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", scan_status, default="pending", nullable=False),
        sa.Column("configuration", scan_configuration, default="repoverix", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("summary", postgresql.JSONB()),
        sa.Column("llm_token_usage", postgresql.JSONB()),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Analysis runs table
    op.create_table(
        "analysis_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("stage", analysis_stage, nullable=False),
        sa.Column("tool_name", sa.String(100)),
        sa.Column("status", run_status, default="pending", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("output", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Files table
    op.create_table(
        "files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("path", sa.String(1024), nullable=False),
        sa.Column("language", sa.String(50)),
        sa.Column("size_bytes", sa.Integer(), default=0, nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("is_test", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Symbols table
    op.create_table(
        "symbols",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("kind", symbol_kind, nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("qualified_name", sa.String(1024), nullable=False, index=True),
        sa.Column("line_start", sa.Integer(), nullable=False),
        sa.Column("line_end", sa.Integer(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), default=dict, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Dependencies table
    op.create_table(
        "dependencies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ecosystem", ecosystem, nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("version", sa.String(100)),
        sa.Column("is_dev", sa.Boolean(), default=False, nullable=False),
        sa.Column("vulnerability_info", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Findings table
    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("external_id", sa.String(32), nullable=False),
        sa.Column("category", finding_category, nullable=False),
        sa.Column("severity", severity, nullable=False),
        sa.Column("status", finding_status, nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("impact", sa.Text()),
        sa.Column("recommendation", sa.Text()),
        sa.Column("file_path", sa.String(1024), nullable=False),
        sa.Column("function_name", sa.String(300)),
        sa.Column("line_start", sa.Integer()),
        sa.Column("line_end", sa.Integer()),
        sa.Column("source", finding_source, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("scan_id", "external_id", name="uq_finding_scan_external"),
    )

    # Evidence table
    op.create_table(
        "evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("finding_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("kind", evidence_kind, nullable=False),
        sa.Column("file_path", sa.String(1024)),
        sa.Column("line_start", sa.Integer()),
        sa.Column("line_end", sa.Integer()),
        sa.Column("snippet", sa.Text()),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("order_index", sa.Integer(), default=0, nullable=False),
        sa.Column("metadata", postgresql.JSONB(), default=dict, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Patches table
    op.create_table(
        "patches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("finding_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("diff", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text()),
        sa.Column("generated_by", sa.String(100), nullable=False),
        sa.Column("status", patch_status, default="candidate", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Verification runs table
    op.create_table(
        "verification_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("patch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", verification_status, default="pending", nullable=False),
        sa.Column("patch_applied", sa.Boolean(), default=False, nullable=False),
        sa.Column("deps_installed", sa.Boolean(), default=False, nullable=False),
        sa.Column("tests_passed", sa.Boolean()),
        sa.Column("static_passed", sa.Boolean()),
        sa.Column("finding_still_detected", sa.Boolean()),
        sa.Column("logs", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Test results table
    op.create_table(
        "test_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("verification_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("verification_runs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("test_name", sa.String(1024), nullable=False),
        sa.Column("outcome", test_outcome, nullable=False),
        sa.Column("duration_ms", sa.Integer()),
        sa.Column("output", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("test_results")
    op.drop_table("verification_runs")
    op.drop_table("patches")
    op.drop_table("evidence")
    op.drop_table("findings")
    op.drop_table("dependencies")
    op.drop_table("symbols")
    op.drop_table("files")
    op.drop_table("analysis_runs")
    op.drop_table("scans")
    op.drop_table("repositories")
    op.drop_table("users")

    # Drop enum types
    test_outcome = postgresql.ENUM(name="test_outcome")
    test_outcome.drop(op.get_bind(), checkfirst=True)
    verification_status = postgresql.ENUM(name="verification_status")
    verification_status.drop(op.get_bind(), checkfirst=True)
    patch_status = postgresql.ENUM(name="patch_status")
    patch_status.drop(op.get_bind(), checkfirst=True)
    evidence_kind = postgresql.ENUM(name="evidence_kind")
    evidence_kind.drop(op.get_bind(), checkfirst=True)
    finding_source = postgresql.ENUM(name="finding_source")
    finding_source.drop(op.get_bind(), checkfirst=True)
    finding_status = postgresql.ENUM(name="finding_status")
    finding_status.drop(op.get_bind(), checkfirst=True)
    severity = postgresql.ENUM(name="severity")
    severity.drop(op.get_bind(), checkfirst=True)
    finding_category = postgresql.ENUM(name="finding_category")
    finding_category.drop(op.get_bind(), checkfirst=True)
    ecosystem = postgresql.ENUM(name="ecosystem")
    ecosystem.drop(op.get_bind(), checkfirst=True)
    symbol_kind = postgresql.ENUM(name="symbol_kind")
    symbol_kind.drop(op.get_bind(), checkfirst=True)
    run_status = postgresql.ENUM(name="run_status")
    run_status.drop(op.get_bind(), checkfirst=True)
    analysis_stage = postgresql.ENUM(name="analysis_stage")
    analysis_stage.drop(op.get_bind(), checkfirst=True)
    scan_configuration = postgresql.ENUM(name="scan_configuration")
    scan_configuration.drop(op.get_bind(), checkfirst=True)
    scan_status = postgresql.ENUM(name="scan_status")
    scan_status.drop(op.get_bind(), checkfirst=True)
    source_type = postgresql.ENUM(name="source_type")
    source_type.drop(op.get_bind(), checkfirst=True)