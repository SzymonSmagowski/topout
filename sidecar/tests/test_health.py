"""GET /health — unauthenticated liveness probe.

Contract: returns 200 with {"status": "ok", "model": <string>}.
No auth required.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.main import app


def test_health_returns_200() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200


def test_health_response_shape_matches_contract() -> None:
    """Contract: status == 'ok' and model is a non-empty string."""
    client = TestClient(app)
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert isinstance(body["model"], str)
    assert body["model"] != ""


def test_health_returns_configured_model(monkeypatch: object) -> None:
    """model field reflects OPENAI_MODEL env var."""
    import pytest

    assert isinstance(monkeypatch, pytest.MonkeyPatch)
    monkeypatch.setenv("OPENAI_MODEL", "gpt-test-model")
    from src.core import settings as settings_module

    settings_module._cached_settings = None

    client = TestClient(app)
    body = client.get("/health").json()
    assert body["model"] == "gpt-test-model"
