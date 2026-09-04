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


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
