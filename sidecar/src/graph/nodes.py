"""LangGraph node implementations for the weekly report pipeline.

Three linear nodes:
  load_payload         — no-op validator (Pydantic already validated at the
                         route boundary, but the node exists so the topology
                         maps 1:1 to the architect's diagram and future
                         validations can land here)
  analyze_stats        — pandas aggregation over sessions + attempts
  synthesize_narrative — calls OpenAI through `llm.client`

Every node takes a `WeeklyReportState` and returns a dict-style state patch
that LangGraph merges back into the typed state.

@see apps/topout/docs/architecture.md §6.3
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from ..core.logger import get_logger
from ..llm.client import LlmErr, synthesize_weekly_narrative
from ..llm.prompts.weekly_report import WEEKLY_REPORT_SYSTEM_PROMPT
from ..schemas import (
    OutcomeLiteral,
    SessionInPayload,
    VGradeLiteral,
    WeeklyReportRequest,
    WeeklyReportStats,
)
from .state import LlmUsageState, WeeklyReportState

log = get_logger(__name__)

ONE_DAY_MS = 86_400_000
SENT_OUTCOMES: frozenset[OutcomeLiteral] = frozenset(("flash", "send", "repeat"))

# V-grade ordinal map — kept in lockstep with `convex/lib/enums.ts`.
_V_GRADES: tuple[VGradeLiteral, ...] = (
    "VB",
    "V0",
    "V1",
    "V2",
    "V3",
    "V4",
    "V5",
    "V6",
    "V7",
    "V8",
    "V9",
    "V10",
    "V11",
    "V12",
    "V13",
    "V14",
    "V15",
    "V16",
    "V17",
)
_GRADE_TO_ORDINAL: dict[VGradeLiteral, int] = {g: i for i, g in enumerate(_V_GRADES)}


def load_payload(state: WeeklyReportState) -> dict[str, Any]:
    """Verify the inbound request is valid Pydantic. No-op patch."""
    _: WeeklyReportRequest = state.request
    return {}


def _attempts_frame(sessions: list[SessionInPayload]) -> pd.DataFrame:
    """Flatten sessions × attempts into a single DataFrame for aggregation."""
    rows: list[dict[str, Any]] = []
    for s in sessions:
        for a in s.attempts:
            rows.append(
                {
                    "session_id": s.session_id,
                    "session_date": s.date,
                    "gym_name": s.gym.name,
                    "grade": a.grade,
                    "grade_ord": _GRADE_TO_ORDINAL.get(a.grade, -1),
                    "outcome": a.outcome,
                    "attempt_count": a.attempt_count,
                    "is_sent": a.outcome in SENT_OUTCOMES,
                }
            )
    if not rows:
        return pd.DataFrame(
            columns=[
                "session_id",
                "session_date",
                "gym_name",
                "grade",
                "grade_ord",
                "outcome",
                "attempt_count",
                "is_sent",
            ],
        )
    return pd.DataFrame(rows)


def _ordinal_to_grade(ordinal: int) -> VGradeLiteral | None:
    if ordinal < 0 or ordinal >= len(_V_GRADES):
        return None
    return _V_GRADES[ordinal]


def _longest_send_streak(sessions: list[SessionInPayload]) -> int:
    """Max consecutive-day streak of "at least one send" days within the week."""
    if not sessions:
        return 0
    days_with_send: set[int] = set()
    for s in sessions:
        if any(a.outcome in SENT_OUTCOMES for a in s.attempts):
            day = s.date // ONE_DAY_MS
            days_with_send.add(int(day))
    if not days_with_send:
        return 0
    ordered = sorted(days_with_send)
    longest = 1
    current = 1
    for i in range(1, len(ordered)):
        if ordered[i] == ordered[i - 1] + 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def analyze_stats(state: WeeklyReportState) -> dict[str, Any]:
    """Compute the WeeklyReportStats blob with pandas."""
    req = state.request
    df = _attempts_frame(req.sessions)

    sends_count = int(df.loc[df["is_sent"], "attempt_count"].sum()) if not df.empty else 0
    total_attempts = int(df["attempt_count"].sum()) if not df.empty else 0
    send_rate = float(sends_count / total_attempts) if total_attempts > 0 else 0.0

    top_grade: VGradeLiteral | None = None
    if not df.empty:
        sent_only = df.loc[df["is_sent"]]
        if not sent_only.empty:
            top_ord = int(sent_only["grade_ord"].max())
            top_grade = _ordinal_to_grade(top_ord)

    gyms_visited = int(df["gym_name"].nunique()) if not df.empty else 0
    longest_send_streak = _longest_send_streak(req.sessions)

    # Prior-week delta: split the week's sessions into the most-recent 7d half
    # and the prior 7d half. v1 weeks are exactly 7d so we approximate the
    # "prev-week" comparison using the baseline send rate instead.
    send_rate_delta_prev_week = 0.0  # No prior-week data ships in the payload.
    send_rate_delta_baseline = round(send_rate - req.baseline.send_rate, 4)

    top_grade_delta = 0
    if top_grade is not None and req.baseline.top_grade is not None:
        top_grade_delta = _GRADE_TO_ORDINAL.get(top_grade, 0) - _GRADE_TO_ORDINAL.get(
            req.baseline.top_grade,
            0,
        )
    elif top_grade is not None and req.baseline.top_grade is None:
        top_grade_delta = _GRADE_TO_ORDINAL.get(top_grade, 0)

    stats = WeeklyReportStats(
        sends_count=sends_count,
        top_grade=top_grade,
        send_rate=round(send_rate, 4),
        total_attempts=total_attempts,
        gyms_visited=gyms_visited,
        longest_send_streak=longest_send_streak,
        send_rate_delta_prev_week=send_rate_delta_prev_week,
        send_rate_delta_baseline=send_rate_delta_baseline,
        top_grade_delta=top_grade_delta,
    )
    return {"stats": stats}


def synthesize_narrative(state: WeeklyReportState) -> dict[str, Any]:
    """Call OpenAI to generate the markdown narrative."""
    if state.stats is None:
        raise RuntimeError("synthesize_narrative invoked before analyze_stats populated stats")
    payload = {
        "week_start": state.request.week_start,
        "week_end": state.request.week_end,
        "user": state.request.user.model_dump(),
        "baseline": state.request.baseline.model_dump(),
        "stats": state.stats.model_dump(),
        "sessions": [s.model_dump() for s in state.request.sessions],
    }
    result = synthesize_weekly_narrative(
        system_prompt=WEEKLY_REPORT_SYSTEM_PROMPT,
        user_payload=payload,
        max_output_chars=4000,
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
    return {"narrative_md": result.text, "usage": usage}
