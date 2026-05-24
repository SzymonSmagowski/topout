"""Compiled LangGraph for the weekly report.

Three nodes, linear topology:
  START → load_payload → analyze_stats → synthesize_narrative → END

State is a single Pydantic `WeeklyReportState`. The graph is compiled once
at module import — LangGraph compilation produces an immutable executor that
is safe to share across requests.
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from .nodes import analyze_stats, load_payload, synthesize_narrative
from .state import WeeklyReportState


def _build_graph() -> Any:
    graph = StateGraph(WeeklyReportState)
    graph.add_node("load_payload", load_payload)
    graph.add_node("analyze_stats", analyze_stats)
    graph.add_node("synthesize_narrative", synthesize_narrative)
    graph.add_edge(START, "load_payload")
    graph.add_edge("load_payload", "analyze_stats")
    graph.add_edge("analyze_stats", "synthesize_narrative")
    graph.add_edge("synthesize_narrative", END)
    return graph.compile()


# Compiled once on first import. Stateless across requests; request-scoped
# data lives in the WeeklyReportState passed to `.invoke`.
GRAPH = _build_graph()


def run_weekly_report(initial: WeeklyReportState) -> WeeklyReportState:
    """Synchronously run the graph and return the final typed state."""
    final = GRAPH.invoke(initial)
    if isinstance(final, WeeklyReportState):
        return final
    # LangGraph returns a dict of patches merged into the model when the
    # state was constructed from a Pydantic model. Re-validate to be safe.
    return WeeklyReportState.model_validate(final)
