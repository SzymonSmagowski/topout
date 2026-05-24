"""Bearer-token auth dependency for protected routes.

The shared secret matches the Convex env var `SIDECAR_SECRET`. Constant-time
comparison via `secrets.compare_digest` so we don't leak via timing.
"""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from .core.settings import Settings, get_settings


def _extract_token(authorization: str | None) -> str | None:
    if authorization is None:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2:
        return None
    scheme, token = parts
    if scheme.lower() != "bearer":
        return None
    stripped = token.strip()
    return stripped if stripped else None


async def verify_bearer(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> None:
    """FastAPI dependency. Raises 401 unless the header matches the secret."""
    expected = settings.sidecar_secret
    if expected == "":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "SIDECAR_SECRET not configured"},
        )
    presented = _extract_token(authorization)
    if presented is None or not secrets.compare_digest(presented, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized"},
        )
