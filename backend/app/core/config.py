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

    cors_origins: list[str] = ["http://localhost:3000"]

    repository_storage_dir: str = "./data/repositories"

    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None

    sandbox_cpu_limit: float = 1.0
    sandbox_memory_limit: str = "1g"
    sandbox_timeout_seconds: int = 600


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
