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

    # --- repository ingestion limits (untrusted content) ---
    max_repo_size_mb: int = 100
    max_file_size_kb: int = 1024
    max_files: int = 5000
    max_symbols: int = 20000
    max_output_log_chars: int = 200000
    git_clone_timeout_seconds: int = 300
    git_binary: str = "git"

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
    # Absolute URL of the frontend, used as the post-OAuth landing origin.
    frontend_url: str = "http://localhost:3000"
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    github_oauth_client_id: str | None = None
    github_oauth_client_secret: str | None = None
    gitlab_oauth_client_id: str | None = None
    gitlab_oauth_client_secret: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
