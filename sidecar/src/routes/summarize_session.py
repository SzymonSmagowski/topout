"""POST /summarize-session — bearer-token-guarded LangGraph invocation.

Wraps the graph in `propagate_attributes` so the Langfuse trace is grouped
under `session_id` / `user_id` for easy filtering in the UI.
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
from ..graph.summarize_session import SummarizeSessionState, run_summarize_session
from ..observability.langfuse import get_callback_handler, get_langfuse_client
from ..schemas import LlmUsage, SummarizeSessionRequest, SummarizeSessionResponse

router = APIRouter()
log = get_logger(__name__)


@router.post(
    "/summarize-session",
    response_model=SummarizeSessionResponse,
    dependencies=[Depends(verify_bearer)],
)
async def generate_session_summary(
    req: SummarizeSessionRequest,
) -> SummarizeSessionResponse | JSONResponse:
    started = time.perf_counter()
    settings = get_settings()
    handler = get_callback_handler()
    callbacks: list[Any] | None = [handler] if handler is not None else None

    # `propagate_attributes` is a no-op-equivalent context manager only when
    # the Langfuse client is configured — otherwise skip it entirely.
    client = get_langfuse_client()
    if client is not None:
        from langfuse import propagate_attributes

        ctx: Any = propagate_attributes(
            user_id=req.user_id,
            session_id=req.session_id,
            tags=[settings.langfuse_environment],
        )
    else:
        ctx = nullcontext()

    initial = SummarizeSessionState(request=req, callbacks=callbacks)
    try:
        with ctx:
            final = run_summarize_session(initial)
    except RuntimeError as exc:
        log.warning("summarize-session graph error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"error": str(exc)},
        )

    if final.text is None or final.usage is None:
        log.error("summarize-session graph returned incomplete state: %s", final)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "graph returned incomplete state"},
        )

    duration_ms = int((time.perf_counter() - started) * 1000)
    response = SummarizeSessionResponse(
        text=final.text,
        usage=LlmUsage(
            input_tokens=final.usage.input_tokens,
            output_tokens=final.usage.output_tokens,
            model=final.usage.model,
            duration_ms=final.usage.duration_ms,
        ),
    )
    log.info(
        "summarize-session ok user=%s session=%s duration_ms=%d "
        "input_tokens=%d output_tokens=%d model=%s",
        req.user_id,
        req.session_id,
        duration_ms,
        final.usage.input_tokens,
        final.usage.output_tokens,
        final.usage.model,
    )
    return response
