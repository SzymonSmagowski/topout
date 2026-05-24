"""Unit tests for src/observability/langfuse.py.

Verifies the graceful no-op behaviour when Langfuse keys are absent AND the
non-None return when keys are present.

These tests forcibly reset the module-level singletons between runs so they
don't bleed across test isolation boundaries.
"""

from __future__ import annotations

from types import ModuleType

import pytest


def _reset_module(mod: ModuleType) -> None:
    """Reset the four singleton fields that the langfuse module caches."""
    mod._client = None  # type: ignore[attr-defined]
    mod._handler = None  # type: ignore[attr-defined]
    mod._client_initialised = False  # type: ignore[attr-defined]
    mod._handler_initialised = False  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Empty keys → graceful no-op
# ---------------------------------------------------------------------------


def test_get_langfuse_client_returns_none_when_keys_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With empty LANGFUSE_PUBLIC_KEY / SECRET_KEY, client must be None."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "")
    from src.core import settings as settings_module
    from src.observability import langfuse as lf_module

    settings_module._cached_settings = None
    _reset_module(lf_module)

    result = lf_module.get_langfuse_client()
    assert result is None


def test_get_callback_handler_returns_none_when_keys_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With empty keys, handler must be None — callback wiring is skipped."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "")
    from src.core import settings as settings_module
    from src.observability import langfuse as lf_module

    settings_module._cached_settings = None
    _reset_module(lf_module)

    result = lf_module.get_callback_handler()
    assert result is None


# ---------------------------------------------------------------------------
# Keys present → non-None returns (wiring exists)
# Langfuse's constructor does NOT do a network call during __init__, so this
# is safe to run without a live Langfuse server.
# ---------------------------------------------------------------------------


def test_get_langfuse_client_returns_non_none_when_keys_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With valid-looking keys, client must not be None."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-fake-test-key")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-fake-test-key")
    monkeypatch.setenv("LANGFUSE_HOST", "http://localhost:9999")  # unreachable — no network hit
    from src.core import settings as settings_module
    from src.observability import langfuse as lf_module

    settings_module._cached_settings = None
    _reset_module(lf_module)

    result = lf_module.get_langfuse_client()
    assert result is not None


def test_get_callback_handler_returns_non_none_when_keys_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With valid-looking keys, handler must not be None."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-fake-test-key")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-fake-test-key")
    monkeypatch.setenv("LANGFUSE_HOST", "http://localhost:9999")
    from src.core import settings as settings_module
    from src.observability import langfuse as lf_module

    settings_module._cached_settings = None
    _reset_module(lf_module)

    result = lf_module.get_callback_handler()
    assert result is not None


# ---------------------------------------------------------------------------
# Double-call is idempotent (singleton pattern)
# ---------------------------------------------------------------------------


def test_get_langfuse_client_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Second call must return the exact same object as the first."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-fake-idempotent")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-fake-idempotent")
    monkeypatch.setenv("LANGFUSE_HOST", "http://localhost:9999")
    from src.core import settings as settings_module
    from src.observability import langfuse as lf_module

    settings_module._cached_settings = None
    _reset_module(lf_module)

    first = lf_module.get_langfuse_client()
    second = lf_module.get_langfuse_client()
    assert first is second
