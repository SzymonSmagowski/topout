"""POST /summarize-session — integration tests.

Covers:
  - 401 without bearer token
  - 422 with malformed body (missing required field)
  - 200 happy path with mocked ChatOpenAI; response shape matches
    SummarizeSessionResponse contract
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from src.main import app
from src.schemas import SummarizeSessionResponse

# ---------------------------------------------------------------------------
# Minimal valid request body — all required fields present.
# ---------------------------------------------------------------------------
_VALID_BODY: dict[str, Any] = {
    "session_id": "sess_abc123",
    "user_id": "user_xyz",
    "session": {
        "date": 1_700_000_000_000,
        "perceived_effort": 7,
        "duration_minutes": 60,
        "notes": None,
    },
    "attempts": [
        {
            "grade": "V4",
            "outcome": "send",
            "attempt_count": 2,
            "notes": None,
        }
    ],
    "baseline": {
        "window_days": 30,
        "sessions_count": 10,
        "send_rate": 0.55,
        "top_grade": "V4",
        "total_attempts": 100,
    },
    "max_output_chars": 240,
}

_AUTH_HEADER = {"Authorization": "Bearer test-secret"}


def test_summarize_returns_401_without_bearer() -> None:
    client = TestClient(app)
    resp = client.post("/summarize-session", json=_VALID_BODY)
    assert resp.status_code == 401


def test_summarize_returns_401_with_wrong_bearer() -> None:
    client = TestClient(app)
    resp = client.post(
        "/summarize-session",
        json=_VALID_BODY,
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert resp.status_code == 401


def test_summarize_returns_422_when_session_id_missing() -> None:
    client = TestClient(app)
    bad_body = {k: v for k, v in _VALID_BODY.items() if k != "session_id"}
    resp = client.post("/summarize-session", json=bad_body, headers=_AUTH_HEADER)
    assert resp.status_code == 422


def test_summarize_returns_422_when_body_is_empty() -> None:
    client = TestClient(app)
    resp = client.post("/summarize-session", json={}, headers=_AUTH_HEADER)
    assert resp.status_code == 422


def _make_ai_message(text: str) -> AIMessage:
    return AIMessage(
        content=text,
        usage_metadata={"input_tokens": 100, "output_tokens": 42, "total_tokens": 142},
    )


def test_summarize_happy_path_returns_text_and_usage() -> None:
    """200 path: mocked ChatOpenAI.invoke returns text; response has text + usage block."""
    mock_response = _make_ai_message("Great session! You sent V4 twice — keep pushing.")

    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        return_value=mock_response,
    ):
        client = TestClient(app)
        resp = client.post("/summarize-session", json=_VALID_BODY, headers=_AUTH_HEADER)

    assert resp.status_code == 200
    body = resp.json()

    # Validate against the Pydantic contract model — raises if shape is wrong.
    parsed = SummarizeSessionResponse.model_validate(body)
    assert parsed.text != ""
    assert parsed.usage.input_tokens >= 0
    assert parsed.usage.output_tokens >= 0
    assert parsed.usage.model != ""
    assert parsed.usage.duration_ms >= 0


def test_summarize_happy_path_text_matches_llm_output() -> None:
    """text field must equal the mocked LLM output (subject to max_output_chars truncation)."""
    expected_text = "Solid V4 flash on your third attempt."
    mock_response = _make_ai_message(expected_text)

    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        return_value=mock_response,
    ):
        client = TestClient(app)
        resp = client.post("/summarize-session", json=_VALID_BODY, headers=_AUTH_HEADER)

    assert resp.status_code == 200
    assert resp.json()["text"] == expected_text


def test_summarize_returns_502_when_llm_raises() -> None:
    """If ChatOpenAI.invoke raises, the route returns 502 (not 500 / unhandled)."""
    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        side_effect=RuntimeError("network timeout"),
    ):
        client = TestClient(app)
        resp = client.post("/summarize-session", json=_VALID_BODY, headers=_AUTH_HEADER)

    assert resp.status_code == 502


def test_summarize_error_response_has_error_field() -> None:
    """On 502, the JSON body has an `error` key (ErrorResponse contract)."""
    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        side_effect=RuntimeError("timeout"),
    ):
        client = TestClient(app)
        resp = client.post("/summarize-session", json=_VALID_BODY, headers=_AUTH_HEADER)

    assert "error" in resp.json()


def test_summarize_respects_max_output_chars() -> None:
    """text is truncated to max_output_chars when LLM returns a longer string."""
    long_text = "x" * 500
    mock_response = _make_ai_message(long_text)

    body = {**_VALID_BODY, "max_output_chars": 100}
    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        return_value=mock_response,
    ):
        client = TestClient(app)
        resp = client.post("/summarize-session", json=body, headers=_AUTH_HEADER)

    assert resp.status_code == 200
    assert len(resp.json()["text"]) <= 100
