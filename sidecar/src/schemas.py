"""Wire-shape Pydantic models for the sidecar HTTP contract.

These are the source of truth for the wire format. The Convex side
(`apps/topout/convex/reportsActions.ts`) has TypeScript mirrors that must
match field-for-field — a BackendTester contract test verifies the shapes
move both ways without losses.

@see apps/topout/docs/architecture.md §6
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Shared literal vocabularies — mirror `convex/lib/enums.ts`.
# ---------------------------------------------------------------------------

VGradeLiteral = Literal[
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
]

OutcomeLiteral = Literal["flash", "send", "repeat", "project", "fall"]


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class GymInPayload(BaseModel):
    """Minimal gym info we ship to the sidecar — name only; no PII concerns."""

    model_config = ConfigDict(extra="ignore")
    name: str


class AttemptInPayload(BaseModel):
    """One attempt row inside a session."""

    model_config = ConfigDict(extra="ignore")
    grade: VGradeLiteral
    outcome: OutcomeLiteral
    attempt_count: int = Field(ge=1)
    notes: str | None = None


class SessionInPayload(BaseModel):
    """One session with its attempts."""

    model_config = ConfigDict(extra="ignore")
    session_id: str
    date: int
    gym: GymInPayload
    perceived_effort: int = Field(ge=1, le=10)
    duration_minutes: int | None = None
    notes: str | None = None
    attempts: list[AttemptInPayload]


class BaselineInPayload(BaseModel):
    """30-day baseline so the narrative can contextualise the week."""

    model_config = ConfigDict(extra="ignore")
    window_days: int = Field(ge=1)
    sessions_count: int = Field(ge=0)
    send_rate: float = Field(ge=0.0, le=1.0)
    top_grade: VGradeLiteral | None = None
    total_attempts: int = Field(ge=0)


class UserMetaInPayload(BaseModel):
    """Caller identity — used only for the narrative's tone."""

    model_config = ConfigDict(extra="ignore")
    display_name: str
    user_id: str


class WeeklyReportRequest(BaseModel):
    """Inbound POST body for `/weekly-report`."""

    model_config = ConfigDict(extra="ignore")
    week_start: int
    week_end: int
    user: UserMetaInPayload
    baseline: BaselineInPayload
    sessions: list[SessionInPayload]


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class WeeklyReportStats(BaseModel):
    """Numeric summary serialised into `weeklyReports.statsJson` on the Convex side."""

    model_config = ConfigDict(extra="ignore")
    sends_count: int = Field(ge=0)
    top_grade: VGradeLiteral | None = None
    send_rate: float = Field(ge=0.0, le=1.0)
    total_attempts: int = Field(ge=0)
    gyms_visited: int = Field(ge=0)
    longest_send_streak: int = Field(ge=0)
    send_rate_delta_prev_week: float
    send_rate_delta_baseline: float
    top_grade_delta: int


class WeeklyReportResponse(BaseModel):
    """Outbound JSON for `/weekly-report` on success."""

    model_config = ConfigDict(extra="ignore")
    narrative_md: str
    stats: WeeklyReportStats
    model: str
    duration_ms: int = Field(ge=0)
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)


class HealthResponse(BaseModel):
    """Outbound JSON for `/health`."""

    model_config = ConfigDict(extra="ignore")
    status: Literal["ok"] = "ok"
    model: str


class ErrorResponse(BaseModel):
    """Outbound JSON for any 4xx/5xx."""

    model_config = ConfigDict(extra="ignore")
    error: str


# ---------------------------------------------------------------------------
# Per-session summarize — `/summarize-session` endpoint.
#
# Convex relays its session + attempts + 30d baseline here so the sidecar
# can synthesize the 1-2 sentence coach blurb. Field names mirror the
# Convex TypeScript wire shape (snake_case JSON over the wire).
# ---------------------------------------------------------------------------


class SummarizeSessionInPayload(BaseModel):
    """The session being summarized — minimal data, no PII beyond user id."""

    model_config = ConfigDict(extra="ignore")
    date: int
    perceived_effort: int = Field(ge=1, le=10)
    duration_minutes: int | None = None
    notes: str | None = None


class SummarizeAttemptInPayload(BaseModel):
    """One attempt row inside the session."""

    model_config = ConfigDict(extra="ignore")
    grade: VGradeLiteral
    outcome: OutcomeLiteral
    attempt_count: int = Field(ge=1)
    notes: str | None = None


class SummarizeBaselineInPayload(BaseModel):
    """30-day baseline so the blurb can contextualise the session."""

    model_config = ConfigDict(extra="ignore")
    window_days: int = Field(ge=1)
    sessions_count: int = Field(ge=0)
    send_rate: float = Field(ge=0.0, le=1.0)
    top_grade: VGradeLiteral | None = None
    total_attempts: int = Field(ge=0)


class SummarizeSessionRequest(BaseModel):
    """Inbound POST body for `/summarize-session`.

    `session_id` and `user_id` are not used by the model — they only feed
    Langfuse so each trace is grouped per-session / per-user in the UI.
    """

    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session: SummarizeSessionInPayload
    attempts: list[SummarizeAttemptInPayload]
    baseline: SummarizeBaselineInPayload
    max_output_chars: int = Field(default=240, ge=50, le=1000)


class LlmUsage(BaseModel):
    """Usage metadata propagated to the Convex side for logging."""

    model_config = ConfigDict(extra="ignore")
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    model: str
    duration_ms: int = Field(ge=0)


class SummarizeSessionResponse(BaseModel):
    """Outbound JSON for `/summarize-session` on success."""

    model_config = ConfigDict(extra="ignore")
    text: str
    usage: LlmUsage
