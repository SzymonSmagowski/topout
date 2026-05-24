"""Sidecar logger setup. Plain stdlib `logging`; no third-party formatter."""

from __future__ import annotations

import logging
from typing import Final

from .settings import get_settings

_LOG_FORMAT: Final[str] = "%(asctime)s %(levelname)s %(name)s — %(message)s"
_DATE_FORMAT: Final[str] = "%Y-%m-%d %H:%M:%S"


def configure_logging() -> None:
    """Initialise root logger from settings.LOG_LEVEL. Idempotent."""
    settings = get_settings()
    level_name = settings.log_level.upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format=_LOG_FORMAT,
        datefmt=_DATE_FORMAT,
    )


def get_logger(name: str) -> logging.Logger:
    """Return a module logger after ensuring the root handler is configured."""
    configure_logging()
    return logging.getLogger(name)
