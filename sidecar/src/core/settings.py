"""Application settings — pydantic-settings reading `.env` next to pyproject.

Settings are validated at startup; missing required values fail loud rather
than half-running with `None` and surprising the operator later.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Sidecar runtime config."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    port: int = Field(default=8000, ge=1, le=65_535)
    log_level: str = Field(default="info")

    sidecar_secret: str = Field(default="")
    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-5.4-nano")

    # ------------------------------------------------------------------
    # Langfuse — observability. Optional: when either key is empty the
    # sidecar runs fine with tracing disabled (graceful no-op). This is
    # what keeps local dev and CI working without any Langfuse setup.
    # ------------------------------------------------------------------
    langfuse_host: str = Field(default="http://langfuse-web:3000")
    langfuse_public_key: str = Field(default="")
    langfuse_secret_key: str = Field(default="")
    langfuse_environment: str = Field(default="development")


_cached_settings: Settings | None = None


def get_settings() -> Settings:
    """Return the singleton settings instance (cached after first call)."""
    global _cached_settings
    if _cached_settings is None:
        _cached_settings = Settings()
    return _cached_settings
