"""FastAPI application factory.

Three routes:
  GET  /health             — unauthenticated
  POST /summarize-session  — bearer-token-guarded
  POST /weekly-report      — bearer-token-guarded

Run via `./run.sh` (uvicorn) or by `apps/topout/dev.sh` which colour-codes
the sidecar logs alongside the frontend + Convex dev server.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request

from .core.logger import configure_logging, get_logger
from .observability.langfuse import get_callback_handler
from .routes.health import router as health_router
from .routes.summarize_session import router as summarize_session_router
from .routes.weekly_report import router as weekly_report_router


def create_app() -> FastAPI:
    configure_logging()
    log = get_logger(__name__)
    app = FastAPI(
        title="TopOut Sidecar",
        version="0.1.0",
        description=(
            "LangGraph LLM gateway for the TopOut bouldering coach app. "
            "Hosts the per-session summarize and weekly-report graphs; "
            "every LLM call is traced into Langfuse."
        ),
    )

    # Touch the Langfuse wiring once at startup so the log line about
    # tracing-enabled-or-not lands before the first request.
    get_callback_handler()

    app.include_router(health_router)
    app.include_router(summarize_session_router)
    app.include_router(weekly_report_router)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        log.info("422 validation error: %s", exc.errors())
        return JSONResponse(
            status_code=422,
            content={"error": "invalid request body", "details": exc.errors()},
        )

    return app


app = create_app()
