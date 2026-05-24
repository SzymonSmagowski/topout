"""POST /weekly-report — bearer-token-guarded LangGraph invocation.

Wraps the graph in `propagate_attributes` so the Langfuse trace is grouped
by user + a synthetic "weekly-<week_start>" session id.
"""

from __future__ import annotations

import time
from contextlib import nullcontext
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from ..auth import verify_bearer
from ..core.logger import get_logger
from ..core.settings import get_settings
from ..graph.state import WeeklyReportState
from ..graph.weekly_report import run_weekly_report
from ..observability.langfuse import get_callback_handler, get_langfuse_client
from ..schemas import WeeklyReportRequest, WeeklyReportResponse

router = APIRouter()
log = get_logger(__name__)


@router.post(
    "/weekly-report",
    response_model=WeeklyReportResponse,
    dependencies=[Depends(verify_bearer)],
)
async def generate_weekly_report(req: WeeklyReportRequest) -> WeeklyReportResponse | JSONResponse:
    started = time.perf_counter()
    settings = get_settings()
    handler = get_callback_handler()
    callbacks: list[Any] | None = [handler] if handler is not None else None

    client = get_langfuse_client()
    if client is not None:
        from langfuse import propagate_attributes

        ctx: Any = propagate_attributes(
            user_id=req.user.user_id,
            session_id=f"weekly-{req.week_start}",
            tags=[settings.langfuse_environment],
        )
    else:
        ctx = nullcontext()

    initial = WeeklyReportState(request=req, callbacks=callbacks)
    try:
        with ctx:
            final = run_weekly_report(initial)
    except RuntimeError as exc:
        log.warning("weekly-report graph error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"error": str(exc)},
        )

    if final.stats is None or final.narrative_md is None or final.usage is None:
        log.error("weekly-report graph returned incomplete state: %s", final)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "graph returned incomplete state"},
        )

    duration_ms = int((time.perf_counter() - started) * 1000)
    response = WeeklyReportResponse(
        narrative_md=final.narrative_md,
        stats=final.stats,
        model=final.usage.model,
        duration_ms=duration_ms,
        input_tokens=final.usage.input_tokens,
        output_tokens=final.usage.output_tokens,
    )
    log.info(
        "weekly-report ok user=%s duration_ms=%d input_tokens=%d output_tokens=%d model=%s",
        req.user.user_id,
        duration_ms,
        final.usage.input_tokens,
        final.usage.output_tokens,
        final.usage.model,
    )
    return response
