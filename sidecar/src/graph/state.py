"""LangGraph state — single typed Pydantic model passed between nodes.

No `dict[str, Any]` in the pipeline. Optional fields are populated by the
node responsible for them (`analyze_stats` fills `.stats`,
`synthesize_narrative` fills `.narrative_md` and `.usage`).

`callbacks` is the Langfuse `CallbackHandler` (when enabled). The
synthesize node passes it to `llm.invoke(config={"callbacks": [...]})` so
each LLM call shows up as a child observation under the graph's trace.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from ..schemas import WeeklyReportRequest, WeeklyReportStats


class LlmUsageState(BaseModel):
    """Subset of the LLM usage info we propagate into the response."""

    model_config = ConfigDict(extra="forbid")
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""
    duration_ms: int = 0


class WeeklyReportState(BaseModel):
    """Mutable state carried through the 3-node graph."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    # Set on entry by the route handler.
    request: WeeklyReportRequest

    # Optional Langfuse callbacks — list of BaseCallbackHandler. `Any` here
    # because we don't want to import langchain just to type a state field
    # that's effectively opaque between graph entry and synthesize node.
    callbacks: list[Any] | None = None

    # Populated by `analyze_stats`.
    stats: WeeklyReportStats | None = None

    # Populated by `synthesize_narrative`.
    narrative_md: str | None = None
    usage: LlmUsageState | None = None
