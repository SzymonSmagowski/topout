"""LLM gateway — the ONLY module in the sidecar that talks to a model.

Architectural rule (locked): every LLM call in the entire TopOut stack flows
through this file. The Convex side relays via HTTP and holds no OpenAI SDK;
the sidecar is the single observability surface, single retry surface, and
single place to swap providers.

Uses `langchain_openai.ChatOpenAI` (not the raw `openai` client) so the
Langfuse `CallbackHandler` can attach via `config={"callbacks": [...]}` and
capture token usage, latency, prompt/response without per-call boilerplate.

One function per call type — currently `synthesize_weekly_narrative` (used
by the weekly-report graph) and `summarize_session` (used by the per-session
summary graph). Public return type is a discriminated `LlmOk | LlmErr`.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Literal

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI

from ..core.logger import get_logger
from ..core.settings import get_settings

log = get_logger(__name__)

# Conservative network timeout. The graph routes wrap the whole invocation
# in their own timing/error envelope; this just bounds the underlying HTTP.
_DEFAULT_TIMEOUT_SECONDS: float = 30.0


@dataclass(frozen=True)
class LlmUsage:
    input_tokens: int
    output_tokens: int
    model: str
    duration_ms: int


@dataclass(frozen=True)
class LlmOk:
    kind: Literal["ok"]
    text: str
    usage: LlmUsage


@dataclass(frozen=True)
class LlmErr:
    kind: Literal["err"]
    error: str


LlmResult = LlmOk | LlmErr


class LlmConfigError(RuntimeError):
    """Raised when the LLM is asked to run without an API key configured."""


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip()


def _build_chat() -> ChatOpenAI:
    settings = get_settings()
    if settings.openai_api_key == "":
        raise LlmConfigError("OPENAI_API_KEY not set")
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        timeout=_DEFAULT_TIMEOUT_SECONDS,
    )


def _extract_usage(response: Any, model: str, duration_ms: int) -> LlmUsage:
    """Pull token counts from a LangChain AIMessage `.usage_metadata` dict.

    The shape is `{"input_tokens": int, "output_tokens": int, ...}`. Older
    backends may omit it; we coerce missing keys to 0 rather than failing.
    """
    raw = getattr(response, "usage_metadata", None)
    if isinstance(raw, dict):
        input_tokens = int(raw.get("input_tokens", 0) or 0)
        output_tokens = int(raw.get("output_tokens", 0) or 0)
    else:
        input_tokens = 0
        output_tokens = 0
    return LlmUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        model=model,
        duration_ms=duration_ms,
    )


def _invoke(
    system_prompt: str,
    user_payload: dict[str, Any],
    max_output_chars: int,
    callbacks: list[BaseCallbackHandler] | None,
) -> LlmResult:
    """Shared invocation path. Both `synthesize_weekly_narrative` and
    `summarize_session` differ only in their prompts + char caps."""
    settings = get_settings()
    model = settings.openai_model
    started = time.perf_counter()
    try:
        chat = _build_chat()
    except LlmConfigError as exc:
        log.error("llm config error: %s", exc)
        return LlmErr(kind="err", error=str(exc))

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=str(user_payload)),
    ]
    config: RunnableConfig | None = RunnableConfig(callbacks=callbacks) if callbacks else None

    try:
        response = chat.invoke(messages, config=config) if config else chat.invoke(messages)
    except Exception as exc:  # ChatOpenAI surfaces openai + httpx errors
        log.warning("llm api error: %s", exc)
        return LlmErr(kind="err", error=f"openai: {exc}")

    raw_text = response.content if isinstance(response.content, str) else str(response.content)
    text = _truncate(raw_text.strip(), max_output_chars)
    duration_ms = int((time.perf_counter() - started) * 1000)
    usage = _extract_usage(response, model=model, duration_ms=duration_ms)
    return LlmOk(kind="ok", text=text, usage=usage)


def synthesize_weekly_narrative(
    system_prompt: str,
    user_payload: dict[str, Any],
    max_output_chars: int,
    callbacks: list[BaseCallbackHandler] | None = None,
) -> LlmResult:
    """Generate the weekly coaching markdown narrative (200–400 words)."""
    return _invoke(system_prompt, user_payload, max_output_chars, callbacks)


def summarize_session(
    system_prompt: str,
    payload: dict[str, Any],
    max_output_chars: int,
    callbacks: list[BaseCallbackHandler] | None = None,
) -> LlmResult:
    """Generate the per-session coach blurb (≤ 240 chars by default)."""
    return _invoke(system_prompt, payload, max_output_chars, callbacks)
