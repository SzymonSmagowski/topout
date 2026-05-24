"""POST /weekly-report — integration tests.

Covers:
  - 401 without bearer token
  - 422 with malformed body (missing required field)
  - 200 happy path with mocked ChatOpenAI; response includes
    narrative_md + WeeklyReportStats contract fields including delta fields
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from src.main import app
from src.schemas import WeeklyReportResponse

_WEEK_START = 1_700_000_000_000
_WEEK_END = _WEEK_START + 7 * 86_400_000 - 1

_VALID_BODY: dict[str, Any] = {
    "week_start": _WEEK_START,
    "week_end": _WEEK_END,
    "user": {
        "display_name": "Alex",
        "user_id": "user_abc",
    },
    "baseline": {
        "window_days": 30,
        "sessions_count": 8,
        "send_rate": 0.50,
        "top_grade": "V3",
        "total_attempts": 80,
    },
    "sessions": [
        {
            "session_id": "sess_001",
            "date": _WEEK_START + 86_400_000,
            "gym": {"name": "The Cave"},
            "perceived_effort": 8,
            "duration_minutes": 90,
            "notes": None,
            "attempts": [
                {
                    "grade": "V5",
                    "outcome": "send",
                    "attempt_count": 3,
                    "notes": None,
                },
                {
                    "grade": "V4",
                    "outcome": "flash",
                    "attempt_count": 1,
                    "notes": None,
                },
                {
                    "grade": "V6",
                    "outcome": "project",
                    "attempt_count": 5,
                    "notes": "almost had it",
                },
            ],
        }
    ],
}

_AUTH_HEADER = {"Authorization": "Bearer test-secret"}


def _make_ai_message(text: str) -> AIMessage:
    return AIMessage(
        content=text,
        usage_metadata={"input_tokens": 200, "output_tokens": 80, "total_tokens": 280},
    )


def test_weekly_report_returns_401_without_bearer() -> None:
    client = TestClient(app)
    resp = client.post("/weekly-report", json=_VALID_BODY)
    assert resp.status_code == 401


def test_weekly_report_returns_401_with_wrong_bearer() -> None:
    client = TestClient(app)
    resp = client.post(
        "/weekly-report",
        json=_VALID_BODY,
        headers={"Authorization": "Bearer wrong"},
    )
    assert resp.status_code == 401


def test_weekly_report_returns_422_when_week_start_missing() -> None:
    client = TestClient(app)
    bad_body = {k: v for k, v in _VALID_BODY.items() if k != "week_start"}
    resp = client.post("/weekly-report", json=bad_body, headers=_AUTH_HEADER)
    assert resp.status_code == 422


def test_weekly_report_returns_422_when_user_missing() -> None:
    client = TestClient(app)
    bad_body = {k: v for k, v in _VALID_BODY.items() if k != "user"}
    resp = client.post("/weekly-report", json=bad_body, headers=_AUTH_HEADER)
    assert resp.status_code == 422


def test_weekly_report_happy_path_response_shape() -> None:
    """200: response matches WeeklyReportResponse contract — all fields present."""
    mock_response = _make_ai_message(
        "## Week in review\n\nStrong session at The Cave. Sent V5 and flashed V4!"
    )

    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        return_value=mock_response,
    ):
        client = TestClient(app)
        resp = client.post("/weekly-report", json=_VALID_BODY, headers=_AUTH_HEADER)

    assert resp.status_code == 200
    body = resp.json()

    # Validate full contract.
    parsed = WeeklyReportResponse.model_validate(body)
    assert parsed.narrative_md != ""
    assert isinstance(parsed.model, str)
    assert parsed.input_tokens >= 0
    assert parsed.output_tokens >= 0
    assert parsed.duration_ms >= 0


def test_weekly_report_stats_block_has_required_delta_fields() -> None:
    """stats block must include the three delta fields: send_rate_delta_prev_week,
    send_rate_delta_baseline, top_grade_delta — these feed the Convex side's
    statsJson without transformation."""
    mock_response = _make_ai_message("Good week!")

    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        return_value=mock_response,
    ):
        client = TestClient(app)
        resp = client.post("/weekly-report", json=_VALID_BODY, headers=_AUTH_HEADER)

    stats = resp.json()["stats"]
    assert "send_rate_delta_prev_week" in stats
    assert "send_rate_delta_baseline" in stats
    assert "top_grade_delta" in stats


def test_weekly_report_stats_sends_count_correct() -> None:
    """sends_count reflects only flash/send/repeat outcomes from the payload."""
    mock_response = _make_ai_message("Narrative text")

    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        return_value=mock_response,
    ):
        client = TestClient(app)
        resp = client.post("/weekly-report", json=_VALID_BODY, headers=_AUTH_HEADER)

    stats = resp.json()["stats"]
    # Flash (1 attempt) + Send (3 attempts) = 4 send attempts. Project doesn't count.
    assert stats["sends_count"] == 4
    assert stats["total_attempts"] == 9  # 3 + 1 + 5


def test_weekly_report_returns_502_when_llm_raises() -> None:
    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        side_effect=RuntimeError("openai down"),
    ):
        client = TestClient(app)
        resp = client.post("/weekly-report", json=_VALID_BODY, headers=_AUTH_HEADER)

    assert resp.status_code == 502
    assert "error" in resp.json()


def test_weekly_report_empty_sessions_returns_zero_stats() -> None:
    """Sessions list can be empty — stats all-zero, narrative still generated."""
    mock_response = _make_ai_message("Rest week — nothing to report.")

    body = {**_VALID_BODY, "sessions": []}
    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        return_value=mock_response,
    ):
        client = TestClient(app)
        resp = client.post("/weekly-report", json=body, headers=_AUTH_HEADER)

    assert resp.status_code == 200
    stats = resp.json()["stats"]
    assert stats["sends_count"] == 0
    assert stats["total_attempts"] == 0
    assert stats["top_grade"] is None
