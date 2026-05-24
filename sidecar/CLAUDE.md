# sidecar/

Python FastAPI service. The single LLM gateway for TopOut. Every OpenAI
call goes through here — Convex actions are thin HTTP relays that post data
and wait for a response.

## Routes

| Route | File | Purpose |
|---|---|---|
| `GET /health` | `routes/health.py` | Liveness probe |
| `POST /summarize-session` | `routes/summarize_session.py` | Per-session AI coaching blurb |
| `POST /weekly-report` | `routes/weekly_report.py` | Weekly markdown narrative |

Both POST routes require `Authorization: Bearer <SIDECAR_SECRET>` matching
the Convex env var of the same name. Convex actions set this header; the
sidecar's `auth.py` middleware validates it before reaching the handler.

## LangGraph topology

Each route runs a 3-node StateGraph defined under `src/graph/`:

- `/summarize-session`: `load_payload` → `format_context` → `synthesize_summary`
- `/weekly-report`: `load_payload` → `analyze_stats` (pandas time-series) → `synthesize_narrative`

State types live in `src/graph/state.py`. Nodes live in `src/graph/nodes.py`
(shared helpers) plus the per-graph files. Graph definitions are in
`src/graph/summarize_session.py` and `src/graph/weekly_report.py`.

## LLM client convention

`src/llm/client.py` exports one function per call type:
`summarize_session(...)` and `synthesize_weekly_narrative(...)`. Every
`ChatOpenAI` instantiation and every `model.invoke()` call lives here.
To swap the model, change this file only — both graphs keep working.

Prompts live in `src/llm/prompts/` as plain strings imported by `client.py`.

## Langfuse wiring

`src/observability/langfuse.py` owns two singletons:
`get_langfuse_client()` and `get_callback_handler()`. Both return `None`
when `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are unset — CI and
local dev without Langfuse configured run cleanly without traces.

Route handlers call `propagate_attributes(user_id, session_id, tags)` then
pass `config={"callbacks": [get_callback_handler()]}` on the
`ChatOpenAI.invoke()` call. This ensures every graph node transition and
every LLM call is captured when tracing is enabled.

The v3 global-singleton pattern is used: instantiating `Langfuse(...)` once
registers it via OpenTelemetry; `CallbackHandler()` needs no arguments.

## Env vars

| Variable | Required | Notes |
|---|---|---|
| `SIDECAR_SECRET` | yes | Must match `npx convex env set SIDECAR_SECRET` |
| `OPENAI_API_KEY` | yes | sk-… |
| `OPENAI_MODEL` | no | Defaults to `gpt-5.4-nano` |
| `LANGFUSE_HOST` | no | Default `http://langfuse-web:3000` |
| `LANGFUSE_PUBLIC_KEY` | no | Leave empty to disable tracing |
| `LANGFUSE_SECRET_KEY` | no | Leave empty to disable tracing |
| `LANGFUSE_ENVIRONMENT` | no | Default `development` |
| `PORT` | no | Default `8000` |

Copy `sidecar/.env.example` → `sidecar/.env` and fill in at minimum
`SIDECAR_SECRET` and `OPENAI_API_KEY`.

## Run

```bash
cd apps/topout/sidecar
poetry install
poetry run uvicorn src.main:app --reload --port 8000

# Or via dev.sh from apps/topout/ — starts all three services together
./dev.sh
```

## Tests

```bash
cd apps/topout/sidecar
poetry run pytest -q
```

The test suite is fast (<2s). It stubs the Langfuse client and patches
`ChatOpenAI` so no real API key is needed for unit tests.
