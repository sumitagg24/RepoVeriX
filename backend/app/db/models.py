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
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
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


class UserStatus(str, enum.Enum):
    """Explicit account lifecycle states (docs/AUTH.md §Account states).

    active           — full access.
    email_unverified — signed up with a password, email not yet verified:
                       may sign in, verify, resend, export/delete own data;
                       provider connections, repository registration and
                       scans are refused server-side.
    suspended        — administrative hold: cannot authenticate.
    deleted          — terminal state after account deletion: cannot
                       authenticate; rows exist only for audit integrity.
    """

    active = "active"
    email_unverified = "email_unverified"
    suspended = "suspended"
    deleted = "deleted"


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
    website_audits_used: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )

    # Set when the user finishes (or explicitly skips) the first-run onboarding
    # checklist; drives the /onboarding wizard and the dashboard checklist card.
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- account security (docs/AUTH.md) ---
    status: Mapped[UserStatus] = mapped_column(
        enum_type(UserStatus, "user_status"), default=UserStatus.active, nullable=False
    )
    # Password accounts verify via a one-time emailed link; OAuth-created
    # accounts are verified at creation (the provider returned the address).
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Persistent progressive lockout state (see settings: auth_max_failed_*).
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Bumped to invalidate every outstanding JWT (logout-all, password change,
    # password reset, suspension). Tokens carry a ``tv`` claim; a mismatch is
    # rejected, which is what makes stateless sessions revocable.
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # One-time tokens are stored as SHA-256 hashes — a database leak cannot
    # yield a usable verification/reset link.
    verification_token_hash: Mapped[str | None] = mapped_column(String(64))
    verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_reset_token_hash: Mapped[str | None] = mapped_column(String(64))
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

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
    # When set, the repository belongs to an organization and is accessible to
    # its members according to their role (see ``app/services/access.py``).
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("organizations.id", ondelete="SET NULL"), index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(enum_type(SourceType, "source_type"))
    source_url: Mapped[str | None] = mapped_column(String(2048))
    default_branch: Mapped[str] = mapped_column(String(200), default="main", nullable=False)
    storage_path: Mapped[str | None] = mapped_column(String(1024))
    primary_languages: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="registered", nullable=False)
    # Shared webhook secret (HMAC) used by CI providers to authenticate
    # re-scan deliveries. Returned once at creation; never logged.
    webhook_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
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


class HealthSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One point on the repository health timeline.

    Written whenever the intelligence bundle is (re)computed, keyed by the
    working-copy commit so repeat computes of the same code collapse to one
    point. The series renders the repository's health over time.
    """

    __tablename__ = "health_snapshots"
    __table_args__ = (UniqueConstraint("repository_id", "commit_sha", name="uq_health_snapshot_repo_commit"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    commit_sha: Mapped[str | None] = mapped_column(String(64))
    average_score: Mapped[float | None] = mapped_column(Float)
    files_scored: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distribution: Mapped[dict[str, int] | None] = mapped_column(JSON)
    worst_files: Mapped[list[str] | None] = mapped_column(JSON)

    repository: Mapped[Repository] = relationship()


class PullRequestAudit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One recorded GitHub pull-request audit (base..head diff, impact, findings).

    ``review`` holds the full structured review (risk, factors, findings,
    evidence, line comments). Findings are intentionally *not* persisted as
    ``Finding`` rows — they are diff-scoped evidence, not repository findings.
    """

    __tablename__ = "pull_request_audits"
    __table_args__ = (UniqueConstraint("repository_id", "pr_number", name="uq_pr_audit_repo_pr"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)
    pr_title: Mapped[str | None] = mapped_column(String(500))
    pr_url: Mapped[str | None] = mapped_column(String(2048))
    author: Mapped[str | None] = mapped_column(String(200))
    base_ref: Mapped[str | None] = mapped_column(String(200))
    base_sha: Mapped[str | None] = mapped_column(String(64))
    head_ref: Mapped[str | None] = mapped_column(String(200))
    head_sha: Mapped[str | None] = mapped_column(String(64))
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), default="low", nullable=False)
    changed_files: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    findings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    review: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    posted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)

    repository: Mapped[Repository] = relationship()


class ChangeAudit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One recorded PR / change audit (base..head refs or a raw diff)."""

    __tablename__ = "change_audits"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    mode: Mapped[str] = mapped_column(String(20), default="refs", nullable=False)  # refs | diff
    base: Mapped[str | None] = mapped_column(String(200))
    head: Mapped[str | None] = mapped_column(String(200))
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    repository: Mapped[Repository] = relationship()


class ValidationRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One counterexample-based validation of a finding (research log).

    Keeps the pre/post verdict and the full deterministic check output so
    RepoVeriX experiments can compute verified/probable/rejected rates and
    false-positive reduction (a candidate that flips to REJECTED is a
    confirmed false positive).
    """

    __tablename__ = "validation_runs"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("findings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    rule: Mapped[str | None] = mapped_column(String(100))
    status_before: Mapped[str] = mapped_column(String(20), nullable=False)
    status_after: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    checks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    finding: Mapped["Finding"] = relationship()


class GeneratedTest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A regression test generated for a finding, with its execution outcome."""

    __tablename__ = "generated_tests"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("findings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    language: Mapped[str] = mapped_column(String(30), default="python", nullable=False)
    test_code: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="generated", nullable=False)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    finding: Mapped["Finding"] = relationship()


class Scan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scans"
    # Composite index backing "most recent scans of this repository" lists and
    # the repository timeline — far cheaper than index-hopping per row.
    __table_args__ = (Index("ix_scans_repository_created", "repository_id", "created_at"),)

    # Client-supplied ``Idempotency-Key`` header value (when provided) so a
    # retried scan-creation request resolves to its original scan instead of
    # queueing a duplicate.
    idempotency_key: Mapped[str | None] = mapped_column(String(128), index=True)

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
    __table_args__ = (Index("ix_analysis_runs_scan_stage", "scan_id", "stage"),)

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
    __table_args__ = (
        UniqueConstraint("scan_id", "external_id", name="uq_finding_scan_external"),
        # Findings-list filters (scan + severity + status) are the most common
        # query shape in the UI and the regression/dedup comparisons.
        Index("ix_findings_scan_severity_status", "scan_id", "severity", "status"),
        Index("ix_findings_scan_file", "scan_id", "file_path"),
    )

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
    __table_args__ = (Index("ix_evidence_finding_order", "finding_id", "order_index"),)

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


# ------------------------------------------------------------------ feedback & sharing


class FindingFeedback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user's verdict on a finding (the false-positive feedback loop).

    One row per (finding, user): submitting again replaces the earlier verdict
    so the aggregate always reflects the user's current judgement. Verdicts
    feed detection-quality metrics (confirmed true positives, reported false
    positives, already-fixed confirmations) — they never change a finding's
    pipeline status by themselves.
    """

    __tablename__ = "finding_feedback"
    __table_args__ = (UniqueConstraint("finding_id", "user_id", name="uq_finding_feedback_finding_user"),)

    finding_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("findings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # correct | incorrect | already_fixed | not_useful (validated at the API)
    verdict: Mapped[str] = mapped_column(String(30), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    finding: Mapped[Finding] = relationship()


class ReportShare(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A revocable secret-URL share of one scan report.

    The token is a 32-byte urlsafe secret resolved only by
    ``GET /api/v1/public/reports/{token}``. Shares carry NO authentication and
    therefore serve a sanitised report: evidence code snippets, repository
    source URLs and LLM/token usage are stripped (see
    ``app/services/sharing.py``). Owners can revoke at any time; expiry is
    optional.
    """

    __tablename__ = "report_shares"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    scan: Mapped[Scan] = relationship()


# ------------------------------------------------------------------ organizations & RBAC


class OrgRole(str, enum.Enum):
    """Organization roles, least to most privilege.

    member  — read access to org repositories, runs scans, sees findings.
    admin   — member + add/remove members, manage repositories.
    owner   — admin + delete the organization, transfer/remove owners.
    """

    member = "member"
    admin = "admin"
    owner = "owner"

    @property
    def rank(self) -> int:
        return {OrgRole.member: 0, OrgRole.admin: 1, OrgRole.owner: 2}[self]


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A team workspace grouping repositories and members."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    members: Mapped[list["OrganizationMember"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class OrganizationMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One user's membership (and role) in an organization."""

    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_member_org_user"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[OrgRole] = mapped_column(
        enum_type(OrgRole, "org_role"), default=OrgRole.member, nullable=False
    )
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(foreign_keys=[user_id])


# ------------------------------------------------------------------ API tokens (CI)


class ApiToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A personal API token for CI / headless API access.

    Only the SHA-256 hash of the secret is stored — a database leak cannot
    recover usable credentials. The plaintext token is shown exactly once at
    creation. Tokens carry the same identity and authorization as their user;
    revocation is immediate and tracked.
    """

    __tablename__ = "api_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    token_prefix: Mapped[str] = mapped_column(String(12), nullable=False)  # display only
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(foreign_keys=[user_id])


class AuthEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Security audit trail for authentication events.

    One row per AUTH_* event (signup, login success/failure, lockouts, password
    reset, provider connect/disconnect, session revocation, webhook sync).
    Never stores credentials, tokens or cookies — only who/what/where metadata
    (see ``app/services/authaudit.py`` for the event catalogue).
    """

    __tablename__ = "auth_events"
    __table_args__ = (Index("ix_auth_events_user_created", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Kept even when the user row is deleted (audit integrity after deletion).
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    event: Mapped[str] = mapped_column(String(40), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64))
    # Small structured detail (provider name, user-agent class, failure reason
    # code). Never raw provider responses or secrets.
    detail: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class ProcessedAuthWebhook(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Idempotency ledger for inbound authentication webhooks.

    Delivery is at-least-once, so every processed event id is recorded here;
    replays are acknowledged (200, ``duplicate``) without re-applying the
    mutation. Out-of-order events are tolerated by upsert semantics.
    """

    __tablename__ = "processed_auth_webhooks"

    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="repoverix-local")
    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    __table_args__ = (UniqueConstraint("provider", "event_id", name="uq_auth_webhook_provider_event"),)


class Website(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user-registered public website targeted by passive audits.

    ``hostname`` is the canonical, lowercased host (IDNA-stripped at the
    edge); ``url`` preserves the scheme the owner registered. Audits are
    passive: RepoVeriX fetches and analyses what a browser would see — it
    never attacks, fuzzes or authenticates to the target.
    """

    __tablename__ = "websites"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    hostname: Mapped[str] = mapped_column(String(253), index=True, nullable=False)
    label: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False)
    last_audit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    audits: Mapped[list["WebsiteAudit"]] = relationship(
        back_populates="website", cascade="all, delete-orphan"
    )


class WebsiteAudit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One passive website audit run.

    ``scores`` / ``summary`` are plain JSON payloads served verbatim by the
    API; ``pages`` mirrors the crawl graph, ``findings`` the normalised
    observations. Website findings are observations of *public* surface —
    they never assert vulnerabilities, only what was observed and what a
    cautious operator might improve.
    """

    __tablename__ = "website_audits"
    __table_args__ = (Index("ix_website_audits_website_created", "website_id", "created_at"),)

    website_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("websites.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    max_pages: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    max_depth: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    pages_crawled: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)

    scores: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    pages: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    findings: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    evidence: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)

    website: Mapped[Website] = relationship(back_populates="audits")


# ------------------------------------------------------------------ scheduled scans


class ScheduledScan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A recurring scan schedule attached to one repository.

    The scheduler tick (``app/analysis/scheduler.py``) checks every minute for
    schedules whose ``next_run_at`` has passed, fires a new ``Scan``, then
    advances ``next_run_at`` by the interval.  Only one pending/running scan per
    repository is allowed at a time (the tick skips if one is in-flight).

    ``interval_hours`` is the recurrence period (min 1, max 720 = 30 days).
    ``configuration`` mirrors ``ScanConfiguration``; defaults to the full
    ``repoverix`` pipeline but can be set to ``static_only`` for cheaper
    scheduled runs.

    ``last_scan_id`` tracks the most recent scan triggered by this schedule
    (informational; not enforced as a FK constraint so deleting a scan does
    not cascade to the schedule).
    """

    __tablename__ = "scheduled_scans"
    __table_args__ = (
        UniqueConstraint("repository_id", name="uq_scheduled_scan_repository"),
    )

    repository_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("repositories.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    interval_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    configuration: Mapped[ScanConfiguration] = mapped_column(
        enum_type(ScanConfiguration, "scan_configuration"),
        default=ScanConfiguration.repoverix,
        nullable=False,
    )
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_scan_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)

    repository: Mapped[Repository] = relationship()
