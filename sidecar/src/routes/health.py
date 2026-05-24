"""GET /health — unauthenticated liveness probe used by the frontend banner."""

from __future__ import annotations

from fastapi import APIRouter

from ..core.settings import get_settings
from ..schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", model=settings.openai_model)
