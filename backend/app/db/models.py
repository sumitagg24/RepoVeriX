"""ORM models for the RepoVeriX domain.

The schema follows the pipeline: a ``Repository`` is scanned by a ``Scan`` (in one of
four experimental configurations). Each scan records ``AnalysisRun`` stages, parsed
``File``/``Symbol`` information, ``Dependency`` records and ``Finding`` entries. Every
finding carries ordered ``Evidence`` nodes (the evidence graph) and may have candidate
``Patch`` objects whose ``VerificationRun`` results and ``TestResult`` rows record whether
the repair was actually verified.
"""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import GUID, Base, TimestampMixin, UUIDPrimaryKeyMixin


# --------------------------------------------------------------------------- enums
class SourceType(str, enum.Enum):
    github = "github"
    gitlab = "gitlab"
    git = "git"
    archive = "archive"
    zip = "zip"

    @property
    def is_git_clone(self) -> bool:
        return self in (SourceType.github, SourceType.gitlab, SourceType.git)

    @property
    def is_archive(self) -> bool:
        return self in (SourceType.archive, SourceType.zip)


class ScanStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ScanConfiguration(str, enum.Enum):
    """Experimental configurations compared in the research (Section 22)."""

    static_only = "static_only"
    llm_only = "llm_only"
    static_llm = "static_llm"
    repoverix = "repoverix"


class AnalysisStage(str, enum.Enum):
    ingestion = "ingestion"
    parsing = "parsing"
    static_analysis = "static_analysis"
    knowledge_graph = "knowledge_graph"
    llm_reasoning = "llm_reasoning"
    evidence_validation = "evidence_validation"
    repair = "repair"
    verification = "verification"


class RunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class SymbolKind(str, enum.Enum):
    function = "function"
    class_ = "class"
    method = "method"
    variable = "variable"
    import_ = "import"


class Ecosystem(str, enum.Enum):
    pypi = "pypi"
    npm = "npm"


class FindingCategory(str, enum.Enum):
    security = "security"
    logic = "logic"
    api_misuse = "api_misuse"
    database = "database"
    dependency = "dependency"
    reliability = "reliability"


class Severity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class FindingStatus(str, enum.Enum):
    verified = "verified"
    probable = "probable"
    rejected = "rejected"


class FindingSource(str, enum.Enum):
    static = "static"
    llm = "llm"
    hybrid = "hybrid"


class EvidenceKind(str, enum.Enum):
    source_input = "source_input"
    transformation = "transformation"
    sink = "sink"
    static_analysis = "static_analysis"
    dependency = "dependency"
    test = "test"
    llm_reasoning = "llm_reasoning"
    call_relationship = "call_relationship"


class PatchStatus(str, enum.Enum):
    candidate = "candidate"
    applied = "applied"
    verified = "verified"
    failed = "failed"
    not_verified = "not_verified"


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    verified_repair = "verified_repair"
    repair_failed = "repair_failed"
    repair_not_verified = "repair_not_verified"


class TestOutcome(str, enum.Enum):
    passed = "passed"
    failed = "failed"
    error = "error"
    skipped = "skipped"


def enum_type(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Build a SQLAlchemy Enum that stores enum *values* (not member names)."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


# --------------------------------------------------------------------------- models
class PlanName(str, enum.Enum):
    free = "free"
    pro = "pro"
    team = "team"


class SubscriptionStatus(str, enum.Enum):
    """Stripe subscription lifecycle (mirrors the API)."""

    active = "active"
    trialing = "trialing"
    past_due = "past_due"
    canceled = "canceled"
    incomplete = "incomplete"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # --- subscription & usage (billing) ---
    plan: Mapped[PlanName] = mapped_column(
        enum_type(PlanName, "plan_name"), default=PlanName.free, nullable=False
    )
    subscription_status: Mapped[SubscriptionStatus | None] = mapped_column(
        enum_type(SubscriptionStatus, "subscription_status"), nullable=True
    )
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stripe_customer_id: Mapped[str | None] = mapped_column(String(200), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(200))
    # Monthly usage counters, rolled over when ``current_period_end`` passes.
    scans_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fixes_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verifications_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    repositories: Mapped[list["Repository"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class OAuthAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user's connected third-party account (Google/GitHub/GitLab).

    Access tokens are stored so scans can clone repositories the user granted
    access to. Treat the database as a secret store: restrict access and keep
    ``REPOVERIX_JWT_SECRET`` strong (tokens are not logged anywhere).
    """

    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_oauth_user_provider"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_email: Mapped[str | None] = mapped_column(String(320))
    provider_name: Mapped[str | None] = mapped_column(String(200))
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="oauth_accounts")


class Repository(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "repositories"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(enum_type(SourceType, "source_type"))
    source_url: Mapped[str | None] = mapped_column(String(2048))
    default_branch: Mapped[str] = mapped_column(String(200), default="main", nullable=False)
    storage_path: Mapped[str | None] = mapped_column(String(1024))
    primary_languages: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="registered", nullable=False)
    oauth_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("oauth_accounts.id", ondelete="SET NULL"), nullable=True
    )

    owner: Mapped[User] = relationship(back_populates="repositories")
    oauth_account: Mapped[OAuthAccount | None] = relationship(foreign_keys=[oauth_account_id])
    scans: Mapped[list["Scan"]] = relationship(back_populates="repository", cascade="all, delete-orphan")
    insight: Mapped["RepositoryInsight | None"] = relationship(
        back_populates="repository", cascade="all, delete-orphan", uselist=False
    )


class RepositoryInsight(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Cached repository-intelligence snapshot (code health, git analytics,
    file wiki, architecture) computed deterministically from the working copy.

    ``health`` / ``git`` / ``wiki`` / ``architecture`` are plain JSON payloads
    served verbatim by the API; ``status`` records the last compute outcome.
    """

    __tablename__ = "repository_insights"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("repositories.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    commit_sha: Mapped[str | None] = mapped_column(String(64))
    health: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    git: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    wiki: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    architecture: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    repository: Mapped[Repository] = relationship(back_populates="insight")


class Scan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scans"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[ScanStatus] = mapped_column(
        enum_type(ScanStatus, "scan_status"), default=ScanStatus.pending, nullable=False
    )
    configuration: Mapped[ScanConfiguration] = mapped_column(
        enum_type(ScanConfiguration, "scan_configuration"),
        default=ScanConfiguration.repoverix,
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    llm_token_usage: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)

    repository: Mapped[Repository] = relationship(back_populates="scans")
    analysis_runs: Mapped[list["AnalysisRun"]] = relationship(
        back_populates="scan", cascade="all, delete-orphan"
    )
    files: Mapped[list["File"]] = relationship(back_populates="scan", cascade="all, delete-orphan")
    dependencies: Mapped[list["Dependency"]] = relationship(
        back_populates="scan", cascade="all, delete-orphan"
    )
    findings: Mapped[list["Finding"]] = relationship(back_populates="scan", cascade="all, delete-orphan")


class AnalysisRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "analysis_runs"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    stage: Mapped[AnalysisStage] = mapped_column(enum_type(AnalysisStage, "analysis_stage"))
    tool_name: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[RunStatus] = mapped_column(
        enum_type(RunStatus, "run_status"), default=RunStatus.pending, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    output: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    scan: Mapped[Scan] = relationship(back_populates="analysis_runs")


class File(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "files"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    path: Mapped[str] = mapped_column(String(1024), nullable=False)
    language: Mapped[str | None] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    is_test: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    scan: Mapped[Scan] = relationship(back_populates="files")
    symbols: Mapped[list["Symbol"]] = relationship(back_populates="file", cascade="all, delete-orphan")


class Symbol(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "symbols"

    file_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("files.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[SymbolKind] = mapped_column(enum_type(SymbolKind, "symbol_kind"))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    qualified_name: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    line_start: Mapped[int] = mapped_column(Integer, nullable=False)
    line_end: Mapped[int] = mapped_column(Integer, nullable=False)
    extra: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    file: Mapped[File] = relationship(back_populates="symbols")


class Dependency(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "dependencies"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    ecosystem: Mapped[Ecosystem] = mapped_column(enum_type(Ecosystem, "ecosystem"))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    version: Mapped[str | None] = mapped_column(String(100))
    is_dev: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vulnerability_info: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    scan: Mapped[Scan] = relationship(back_populates="dependencies")


class Finding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("scan_id", "external_id", name="uq_finding_scan_external"),)

    scan_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    external_id: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[FindingCategory] = mapped_column(enum_type(FindingCategory, "finding_category"))
    severity: Mapped[Severity] = mapped_column(enum_type(Severity, "severity"))
    status: Mapped[FindingStatus] = mapped_column(enum_type(FindingStatus, "finding_status"))
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    impact: Mapped[str | None] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    function_name: Mapped[str | None] = mapped_column(String(300))
    line_start: Mapped[int | None] = mapped_column(Integer)
    line_end: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[FindingSource] = mapped_column(enum_type(FindingSource, "finding_source"))

    scan: Mapped[Scan] = relationship(back_populates="findings")
    evidence: Mapped[list["Evidence"]] = relationship(
        back_populates="finding",
        cascade="all, delete-orphan",
        order_by="Evidence.order_index",
    )
    patches: Mapped[list["Patch"]] = relationship(back_populates="finding", cascade="all, delete-orphan")


class Evidence(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One node of a finding's evidence graph (source -> transformation -> sink, etc.)."""

    __tablename__ = "evidence"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("findings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[EvidenceKind] = mapped_column(enum_type(EvidenceKind, "evidence_kind"))
    file_path: Mapped[str | None] = mapped_column(String(1024))
    line_start: Mapped[int | None] = mapped_column(Integer)
    line_end: Mapped[int | None] = mapped_column(Integer)
    snippet: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    extra: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    finding: Mapped[Finding] = relationship(back_populates="evidence")


class Patch(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "patches"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("findings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    diff: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    generated_by: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[PatchStatus] = mapped_column(
        enum_type(PatchStatus, "patch_status"), default=PatchStatus.candidate, nullable=False
    )

    finding: Mapped[Finding] = relationship(back_populates="patches")
    verification_runs: Mapped[list["VerificationRun"]] = relationship(
        back_populates="patch", cascade="all, delete-orphan"
    )


class VerificationRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "verification_runs"

    patch_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("patches.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[VerificationStatus] = mapped_column(
        enum_type(VerificationStatus, "verification_status"),
        default=VerificationStatus.pending,
        nullable=False,
    )
    patch_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deps_installed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tests_passed: Mapped[bool | None] = mapped_column(Boolean)
    static_passed: Mapped[bool | None] = mapped_column(Boolean)
    finding_still_detected: Mapped[bool | None] = mapped_column(Boolean)
    logs: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    patch: Mapped[Patch] = relationship(back_populates="verification_runs")
    test_results: Mapped[list["TestResult"]] = relationship(
        back_populates="verification_run", cascade="all, delete-orphan"
    )


class TestResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "test_results"

    verification_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("verification_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    test_name: Mapped[str] = mapped_column(String(1024), nullable=False)
    outcome: Mapped[TestOutcome] = mapped_column(enum_type(TestOutcome, "test_outcome"))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    output: Mapped[str | None] = mapped_column(Text)

    verification_run: Mapped[VerificationRun] = relationship(back_populates="test_results")
