"""Shared pytest fixtures. BackendTester adds the actual tests."""
from __future__ import annotations

import os
from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True)
def _env_isolation(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Reset the cached settings singleton between tests so env-var monkeypatch
    in one test doesn't bleed into the next.
    """
    # Default deterministic env for tests; individual tests can override.
    monkeypatch.setenv("SIDECAR_SECRET", os.getenv("SIDECAR_SECRET", "test-secret"))
    monkeypatch.setenv("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY", "test-key"))
    monkeypatch.setenv("OPENAI_MODEL", os.getenv("OPENAI_MODEL", "gpt-5.4-nano"))

    # Bust any singleton cache so the env above takes effect.
    from src.core import settings as settings_module

    settings_module._cached_settings = None

    yield

    settings_module._cached_settings = None
