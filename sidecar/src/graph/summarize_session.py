"""LangGraph for the per-session AI coach blurb.

Mirrors the weekly-report graph topology so the two LLM flows in the app
look the same from the Langfuse trace tree. Three linear nodes:

    START -> load_payload -> format_prompt -> synthesize -> END

The split is deliberate even though `load_payload` and `format_prompt` are
small: each node becomes its own Langfuse observation, so a debugger can
see where a slow / failed run spent its time without ad-hoc instrumentation.
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict

from ..llm.client import LlmErr, summarize_session
from ..llm.prompts.summarize_session import SUMMARIZE_SESSION_PROMPT
from ..schemas import SummarizeSessionRequest
from .state import LlmUsageState


class SummarizeSessionState(BaseModel):
    """Mutable state for the per-session summarize graph."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    # Set on entry by the route handler.
    request: SummarizeSessionRequest
    callbacks: list[Any] | None = None

    # Populated by `format_prompt` — the dict that becomes the user message.
    user_payload: dict[str, Any] | None = None

    # Populated by `synthesize`.
    text: str | None = None
    usage: LlmUsageState | None = None


def load_payload(state: SummarizeSessionState) -> dict[str, Any]:
    """No-op gate. Pydantic already validated the request at the route boundary;
    the node exists so the topology maps 1:1 to the weekly-report graph and any
    future enrichment (e.g. injecting global user prefs) has a home."""
    _: SummarizeSessionRequest = state.request
    return {}


def format_prompt(state: SummarizeSessionState) -> dict[str, Any]:
    """Build the JSON dict the LLM sees as the user message."""
    req = state.request
    payload: dict[str, Any] = {
        "session": req.session.model_dump(),
        "attempts": [a.model_dump() for a in req.attempts],
        "baseline": req.baseline.model_dump(),
    }
    return {"user_payload": payload}


def synthesize(state: SummarizeSessionState) -> dict[str, Any]:
    """Call the LLM gateway. Raises on error so the route maps to 502."""
    if state.user_payload is None:
        raise RuntimeError("synthesize invoked before format_prompt populated user_payload")
    result = summarize_session(
        system_prompt=SUMMARIZE_SESSION_PROMPT,
        payload=state.user_payload,
        max_output_chars=state.request.max_output_chars,
        callbacks=state.callbacks,
    )
    if isinstance(result, LlmErr):
        raise RuntimeError(f"llm error: {result.error}")
    usage = LlmUsageState(
        input_tokens=result.usage.input_tokens,
        output_tokens=result.usage.output_tokens,
        model=result.usage.model,
        duration_ms=result.usage.duration_ms,
    )
    return {"text": result.text, "usage": usage}


def _build_graph() -> Any:
    graph = StateGraph(SummarizeSessionState)
    graph.add_node("load_payload", load_payload)
    graph.add_node("format_prompt", format_prompt)
    graph.add_node("synthesize", synthesize)
    graph.add_edge(START, "load_payload")
    graph.add_edge("load_payload", "format_prompt")
    graph.add_edge("format_prompt", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()


# Compiled once at import; safe to share across requests.
GRAPH = _build_graph()


def run_summarize_session(initial: SummarizeSessionState) -> SummarizeSessionState:
    """Synchronously run the graph and return the final typed state."""
    final = GRAPH.invoke(initial)
    if isinstance(final, SummarizeSessionState):
        return final
    return SummarizeSessionState.model_validate(final)
