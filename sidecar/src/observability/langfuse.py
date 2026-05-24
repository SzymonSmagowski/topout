"""Langfuse wiring — single place that decides whether tracing is on.

The architectural rule: missing keys must NOT crash the sidecar. Local dev,
CI, and any deployment that has not yet been provisioned with a Langfuse
project keep running, just without traces.

Two singletons:
  - `get_langfuse_client()` returns the configured `Langfuse` instance, or
    `None` when tracing is disabled.
  - `get_callback_handler()` returns the LangChain `CallbackHandler` that
    plumbs every `ChatOpenAI` call + every LangGraph node transition into
    Langfuse — also `None` when disabled.

The handler relies on the v3 global-singleton pattern: instantiating
`Langfuse(...)` registers it via OpenTelemetry; the `CallbackHandler()`
constructor needs no arguments because it pulls from that global.

@see project_langfuse_per_app_isolation
"""

from __future__ import annotations

from threading import Lock
from typing import TYPE_CHECKING

from ..core.logger import get_logger
from ..core.settings import get_settings

if TYPE_CHECKING:
    from langfuse import Langfuse
    from langfuse.langchain import CallbackHandler

log = get_logger(__name__)

_client_lock = Lock()
_handler_lock = Lock()
_client: Langfuse | None = None
_handler: CallbackHandler | None = None
_client_initialised: bool = False
_handler_initialised: bool = False


def _credentials_present() -> bool:
    s = get_settings()
    return s.langfuse_public_key != "" and s.langfuse_secret_key != ""


def get_langfuse_client() -> Langfuse | None:
    """Return the singleton Langfuse client, or None when tracing is disabled."""
    global _client, _client_initialised
    if _client_initialised:
        return _client
    with _client_lock:
        if _client_initialised:
            return _client
        _client_initialised = True
        if not _credentials_present():
            log.debug("langfuse disabled — keys not set; tracing is a no-op")
            return None
        # Imported lazily so the dep stays optional from the caller's POV.
        from langfuse import Langfuse

        s = get_settings()
        _client = Langfuse(
            public_key=s.langfuse_public_key,
            secret_key=s.langfuse_secret_key,
            host=s.langfuse_host,
            environment=s.langfuse_environment,
        )
        log.info(
            "langfuse enabled host=%s environment=%s",
            s.langfuse_host,
            s.langfuse_environment,
        )
        return _client


def get_callback_handler() -> CallbackHandler | None:
    """Return the LangChain CallbackHandler, or None when tracing is disabled.

    The handler uses Langfuse v3's global singleton — call `get_langfuse_client()`
    first so the global is registered before the handler is created.
    """
    global _handler, _handler_initialised
    if _handler_initialised:
        return _handler
    with _handler_lock:
        if _handler_initialised:
            return _handler
        _handler_initialised = True
        client = get_langfuse_client()
        if client is None:
            return None
        from langfuse.langchain import CallbackHandler

        _handler = CallbackHandler()
        return _handler
