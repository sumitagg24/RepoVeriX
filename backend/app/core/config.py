"""Application settings loaded from environment variables / .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the RepoVeriX backend.

    Every field can be overridden with an environment variable prefixed with
    ``REPOVERIX_`` (for example ``REPOVERIX_DATABASE_URL``).
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="REPOVERIX_", extra="ignore")

    app_name: str = "RepoVeriX"
    api_prefix: str = "/api/v1"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://repoverix:repoverix@localhost:5432/repoverix"
    auto_create_tables: bool = True

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # --- HTTP security hardening ---
    # Hosts (bare hostnames; ports optional) whose ``Host`` header is accepted.
    # Requests from any other host are rejected with 403 (DNS-rebinding /
    # host-header poisoning defence). An empty list accepts every host — for
    # deployments where the public hostname is not known at startup.
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "test", "testserver"]

    # Serve the interactive API docs (/docs, /redoc, /openapi.json). These
    # expose the full internal route + schema surface and should stay off in
    # production unless explicitly needed. ``debug=True`` enables them too,
    # matching FastAPI's classic default for local development.
    expose_api_docs: bool = False

    repository_storage_dir: str = "./data/repositories"

    # --- repository intelligence (code health, git analytics, wiki) ---
    # Deterministic analysis passes over the working copy, computed on demand
    # and cached in the ``repository_insights`` table. Bounds keep the pass
    # fast on large repositories.
    intel_max_files: int = 300
    intel_wiki_max_files: int = 120
    # How much git history to retain for clones (hotspots/ownership/co-change).
    # The clone is deepened to this window after a shallow fetch; archives and
    # zip uploads have no history and degrade gracefully.
    git_history_months: int = 12

    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None

    sandbox_cpu_limit: float = 1.0
    sandbox_memory_limit: str = "1g"
    sandbox_timeout_seconds: int = 600
    # "none" disables container networking (pip/npm installs then fail); "bridge"
    # allows package downloads during dependency installation
    sandbox_network: str = "bridge"
    # Hard cap on processes a verification container may spawn (fork bombs in
    # untrusted code are a real DoS vector against the host).
    sandbox_pids_limit: int = 256

    # --- rate limiting (see app/core/ratelimit.py) ---
    # Master switch. Keep disabled while running the test suite unless a test
    # explicitly exercises throttling.
    rate_limit_enabled: bool = True
    # Trust ``X-Forwarded-For`` for the client IP (set True behind a reverse
    # proxy that overwrites the header; keep False when the API is public-facing
    # directly).
    trust_proxy_headers: bool = False

    # Authentication endpoints (login / signup / oauth): allowed attempts per
    # window, applied to BOTH the client IP and the account (email) key. When
    # the limit is exceeded the client is locked out with an exponential
    # backoff that starts at ``auth_backoff_base_seconds`` and doubles per
    # repeated violation, capped at ``auth_backoff_max_seconds``.
    auth_rate_limit_attempts: int = 8
    auth_rate_limit_window_seconds: int = 300
    auth_backoff_base_seconds: int = 30
    auth_backoff_max_seconds: int = 3600

    # --- authentication & account security (docs/AUTH.md) ---
    # Identity provider. ``repoverix-local`` is the built-in email/password +
    # OAuth system (bcrypt, stateless JWT). ``supabase`` is reserved for a
    # future *planned* cutover: the inbound auth-webhook receiver already
    # understands external identity events, but switching providers requires
    # the documented migration procedure — never enable it without one.
    auth_provider: str = "repoverix-local"
    # Which social buttons are offered (subset of the configured OAuth specs).
    auth_allowed_social_providers: list[str] = ["google", "github", "gitlab"]
    # Password accounts must verify their email before provider connections,
    # repository registration and scans are allowed (server-side gate).
    auth_require_email_verification: bool = True
    # Reject disposable/temporary email domains at signup (server-side,
    # dataset-driven — see app/services/disposable.py).
    auth_block_disposable_email: bool = True
    # Extra blocked domains administrators can add without a code change.
    auth_extra_blocked_email_domains: list[str] = []
    # Persistent per-account progressive lockout (on top of the IP/account
    # window limiter above): after auth_max_failed_attempts consecutive
    # failures the account cools down for auth_lockout_minutes, multiplied by
    # auth_lockout_backoff_multiplier per further failure, capped at
    # auth_max_lockout_minutes. Never a permanent lock.
    auth_max_failed_attempts: int = 5
    auth_lockout_minutes: int = 5
    auth_max_lockout_minutes: int = 120
    auth_lockout_backoff_multiplier: int = 2
    # One-time email tokens.
    email_verification_token_minutes: int = 60 * 24
    password_reset_token_minutes: int = 60
    # Anti-abuse budgets for mail-generating endpoints (per email, per hour).
    email_resend_per_hour: int = 3
    password_reset_per_hour: int = 3
    # Email delivery. ``console`` prints the message (development only — it
    # includes one-time links, so never use it in production); ``smtp`` sends
    # through the SMTP settings below.
    email_backend: str = "console"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "RepoVeriX <no-reply@repoverix.local>"
    # Optional breached-password screening via the HIBP k-anonymity range API:
    # only the 5-character SHA-1 prefix of the password leaves the process —
    # never the password itself. Off by default (outbound call at signup).
    password_breach_check: bool = False
    # HMAC secret for inbound auth-sync webhooks (POST /auth/webhooks/events).
    # When unset the receiver answers 503 (disabled) instead of trusting.
    auth_webhook_secret: str | None = None

    # Moderate tier for unauthenticated public endpoints (e.g. OAuth
    # entrypoints, provider listing) per client IP.
    public_rate_limit_per_minute: int = 120

    # Loose tier per authenticated user across all API calls.
    user_rate_limit_per_minute: int = 600

    # Expensive / resource-heavy authenticated actions (scan creation, uploads,
    # LLM fix generation, sandbox verification) per user per minute.
    user_action_rate_limit_per_minute: int = 15

    # --- repository ingestion limits (untrusted content) ---
    max_repo_size_mb: int = 100
    max_file_size_kb: int = 1024
    max_files: int = 5000
    max_symbols: int = 20000
    max_output_log_chars: int = 200000
    git_clone_timeout_seconds: int = 300
    git_binary: str = "git"

    # Uploaded archive payload cap in bytes (checked while streaming to disk).
    max_upload_bytes: int = 110 * 1024 * 1024

    # --- LLM providers ---
    llm_timeout_seconds: int = 120
    llm_max_retries: int = 2
    llm_temperature: float = 0.0
    llm_max_candidates_per_scan: int = 60
    llm_max_context_chars: int = 24000
    anthropic_model: str = "claude-3-5-haiku-latest"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    openai_base_url: str | None = None

    # --- OAuth (Google / GitHub / GitLab sign-in & repo import) ---
    # --- billing / subscription ---
    # Enforce plan entitlements (402 when a quota is exhausted). Tests and
    # local dev often disable this; production deployments enable it.
    billing_enforce: bool = True
    # Demo mode: checkout & billing pages simulate success without Stripe
    # credentials (enables trying the full paid flow locally).
    billing_demo_mode: bool = True
    # Monthly usage period length used by the entitlement engine.
    billing_period_days: int = 30
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_pro_price_id: str | None = None
    stripe_team_price_id: str | None = None

    # Absolute URL of the frontend, used as the post-OAuth landing origin.
    # --- security: outbound fetches (SSRF) & secrets at rest ---
    # Reject clones / archive downloads whose host resolves to a private,
    # loopback, link-local or cloud-metadata address. Set true only for
    # self-hosted deployments that intentionally import from an internal git
    # server.
    ssrf_allow_private_hosts: bool = False
    # Fernet key (urlsafe base64, 32 bytes) used to encrypt third-party OAuth
    # access/refresh tokens at rest. When unset (local dev only) tokens are
    # stored as before; production must set it.
    token_encryption_key: str | None = None

    # --- database backups ---
    backup_dir: str = "./data/backups"
    backup_retention_days: int = 14

    frontend_url: str = "http://localhost:3000"
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    github_oauth_client_id: str | None = None
    github_oauth_client_secret: str | None = None
    gitlab_oauth_client_id: str | None = None
    gitlab_oauth_client_secret: str | None = None

    # --- GitHub pull-request auditing ---
    # Optional server-level token for public-repo PR metadata/API calls when a
    # user has not connected their own GitHub account (never required — a
    # connected account's token is used first). Tokens are never logged or
    # exposed to the frontend.
    github_token: str | None = None
    # Base URL for the GitHub REST API (kept configurable so tests can point at
    # a stub server instead of api.github.com).
    github_api_base_url: str = "https://api.github.com"
    github_api_timeout_seconds: int = 60
    # PR audits fetch the pull ref into the clone and analyze a detached worktree.
    pr_worktree_dir: str = "./data/pr-worktrees"


_LOCAL_HOSTS = {"localhost", "127.0.0.1", "test", "testserver", "0.0.0.0"}


def ensure_production_safety(settings: Settings) -> None:
    """Refuse to run with unsafe defaults in a production-like deployment.

    A deployment that looks like production (a public Host allowlist) but still
    runs the built-in ``jwt_secret`` default would let anyone forge session
    tokens for any user, so configuration load fails loudly instead. Local
    development is unaffected: its Host allowlist only contains
    loopback/test values.

    An *empty* allowlist is also production-like: the Host gate accepts every
    host in that mode, so it must never be combined with the default secret.
    """
    host_allowlist = {h.lower() for h in settings.allowed_hosts}
    looks_production = len(host_allowlist) == 0 or not host_allowlist.issubset(_LOCAL_HOSTS)
    if looks_production and settings.jwt_secret == Settings.model_fields["jwt_secret"].default:
        raise RuntimeError(
            "REPOVERIX_JWT_SECRET must be set in production: the default secret "
            "would let anyone forge authentication tokens."
        )


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance, refusing unsafe production defaults."""
    settings = Settings()
    ensure_production_safety(settings)
    return settings
