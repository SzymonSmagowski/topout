"""Unit tests for src/llm/client.py — the LLM gateway module.

All tests mock `langchain_openai.ChatOpenAI.invoke` so no real OpenAI calls
are made. Tests verify:
  - LlmOk returned on success with correct text / usage fields
  - LlmErr returned when invoke raises an exception
  - LlmErr returned when OPENAI_API_KEY is empty
  - max_output_chars truncation happens inside _invoke
  - callbacks are forwarded to the RunnableConfig (not silently dropped)
  - usage_metadata missing from AIMessage coerces to zero (not a crash)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage

from src.llm.client import LlmErr, LlmOk, LlmUsage, summarize_session, synthesize_weekly_narrative


def _make_ai_message(text: str, input_tokens: int = 50, output_tokens: int = 20) -> AIMessage:
    return AIMessage(
        content=text,
        usage_metadata={
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
        },
    )


_SYSTEM_PROMPT = "You are a bouldering coach."
_PAYLOAD: dict[str, Any] = {"session": {"grade": "V5"}}


# ---------------------------------------------------------------------------
# Happy path — summarize_session
# ---------------------------------------------------------------------------


def test_summarize_session_returns_llm_ok_on_success() -> None:
    mock_msg = _make_ai_message("Great session!")
    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg):
        result = summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500)

    assert isinstance(result, LlmOk)
    assert result.kind == "ok"
    assert result.text == "Great session!"


def test_summarize_session_usage_populated() -> None:
    mock_msg = _make_ai_message("Text", input_tokens=123, output_tokens=45)
    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg):
        result = summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500)

    assert isinstance(result, LlmOk)
    assert result.usage.input_tokens == 123
    assert result.usage.output_tokens == 45
    assert isinstance(result.usage, LlmUsage)
    assert result.usage.model != ""
    assert result.usage.duration_ms >= 0


# ---------------------------------------------------------------------------
# Happy path — synthesize_weekly_narrative
# ---------------------------------------------------------------------------


def test_synthesize_weekly_narrative_returns_llm_ok() -> None:
    mock_msg = _make_ai_message("## Week review\n\nYou sent V4 three times.")
    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg):
        result = synthesize_weekly_narrative(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=4000)

    assert isinstance(result, LlmOk)
    assert "V4" in result.text


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------


def test_summarize_session_returns_llm_err_when_invoke_raises() -> None:
    with patch(
        "langchain_openai.ChatOpenAI.invoke",
        side_effect=Exception("rate limit exceeded"),
    ):
        result = summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500)

    assert isinstance(result, LlmErr)
    assert result.kind == "err"
    assert "rate limit" in result.error


def test_summarize_session_returns_llm_err_when_api_key_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "")
    from src.core import settings as settings_module

    settings_module._cached_settings = None

    result = summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500)

    assert isinstance(result, LlmErr)
    assert "OPENAI_API_KEY" in result.error


# ---------------------------------------------------------------------------
# Truncation
# ---------------------------------------------------------------------------


def test_summarize_session_truncates_output_to_max_chars() -> None:
    long_text = "A" * 300
    mock_msg = _make_ai_message(long_text)
    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg):
        result = summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=100)

    assert isinstance(result, LlmOk)
    assert len(result.text) <= 100


def test_summarize_session_does_not_truncate_short_output() -> None:
    short_text = "Good climb!"
    mock_msg = _make_ai_message(short_text)
    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg):
        result = summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500)

    assert isinstance(result, LlmOk)
    assert result.text == short_text


# ---------------------------------------------------------------------------
# Callbacks forwarded to RunnableConfig
# ---------------------------------------------------------------------------


def test_summarize_session_passes_callbacks_to_invoke() -> None:
    """When callbacks are provided, invoke must be called with a config dict
    containing those callbacks — they must not be silently dropped."""
    mock_handler = MagicMock(spec=BaseCallbackHandler)
    mock_msg = _make_ai_message("text")

    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg) as mock_invoke:
        summarize_session(
            _SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500, callbacks=[mock_handler]
        )

    # The second positional/keyword arg to invoke must be a RunnableConfig
    # (or dict) that contains our handler.
    assert mock_invoke.called
    _, kwargs = mock_invoke.call_args
    # invoke(messages, config=...) — config is passed as keyword or positional
    all_args = mock_invoke.call_args[0] + tuple(mock_invoke.call_args[1].values())
    # At least one arg must contain our mock handler
    found = any(
        (hasattr(a, "get") and mock_handler in (a.get("callbacks") or []))
        or (hasattr(a, "callbacks") and mock_handler in (a.callbacks or []))
        for a in all_args
    )
    assert found, f"callbacks not forwarded to invoke. call_args={mock_invoke.call_args}"


def test_summarize_session_no_callbacks_does_not_pass_config() -> None:
    """When callbacks=None, invoke is called without a config kwarg."""
    mock_msg = _make_ai_message("text")

    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg) as mock_invoke:
        summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500, callbacks=None)

    assert mock_invoke.called
    _, kwargs = mock_invoke.call_args
    # config kwarg should not be present when callbacks=None
    assert "config" not in kwargs


# ---------------------------------------------------------------------------
# Missing usage_metadata graceful handling
# ---------------------------------------------------------------------------


def test_summarize_session_handles_missing_usage_metadata() -> None:
    """AIMessage without usage_metadata coerces token counts to 0 rather than crashing."""
    mock_msg = AIMessage(content="No usage info")
    # usage_metadata is None by default when not passed
    assert mock_msg.usage_metadata is None

    with patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_msg):
        result = summarize_session(_SYSTEM_PROMPT, _PAYLOAD, max_output_chars=500)

    assert isinstance(result, LlmOk)
    assert result.usage.input_tokens == 0
    assert result.usage.output_tokens == 0
