# topout / sidecar

Python FastAPI + LangGraph service. **The single LLM gateway** for the whole
TopOut stack — both the per-session summary and the weekly report relay
through here. Convex never imports the OpenAI SDK.

Two LangGraph flows:

- **`/summarize-session`** — 1–2 sentence coach blurb per logged session.
  3 nodes: `load_payload` → `format_prompt` → `synthesize`.
- **`/weekly-report`** — 200–400 word markdown narrative + numeric stats.
  3 nodes: `load_payload` → `analyze_stats` (pandas) → `synthesize_narrative`.

Both use `langchain_openai.ChatOpenAI` under the hood and attach the
Langfuse `CallbackHandler` to every invocation, so each graph node + each
LLM call shows up as a child observation in the Langfuse UI.

The sidecar is **strictly one-directional**: Convex POSTs the entire payload
in, the sidecar returns a JSON response. **There is no Convex client here.**

## Stack

- Python 3.12+ (developed on 3.14), Poetry
- FastAPI + Pydantic v2 + pydantic-settings
- LangGraph 1.x + langchain-openai
- pandas + numpy
- mypy `--strict`, ruff, black

## Run locally

```bash
cd apps/topout/sidecar
cp .env.example .env       # fill OPENAI_API_KEY + paste the same SIDECAR_SECRET you set in Convex
poetry install
./run.sh                   # -> http://localhost:8000
```

Health check:

```bash
curl http://localhost:8000/health
# -> {"status":"ok","model":"gpt-5.4-nano"}
```

The recommended local workflow is `apps/topout/dev.sh` (one command starts
frontend + `convex dev` + this sidecar with interleaved colour-coded logs).

## HTTP contract

### `GET /health`

Public — no auth. Used by the frontend's `SidecarHealthBanner` on `/reports`.

```json
{ "status": "ok", "model": "gpt-5.4-nano" }
```

### `POST /summarize-session`

Bearer-auth. Returns a 1–2 sentence coaching blurb for one logged session.

**Request** — see `src/schemas.py::SummarizeSessionRequest`:

```jsonc
{
  "session_id": "abc123",          // for Langfuse trace grouping
  "user_id":    "u_xyz",           // for Langfuse user filter
  "session": {
    "date": 1734220800000,
    "perceived_effort": 7,
    "duration_minutes": 95,
    "notes": null
  },
  "attempts": [
    { "grade": "V4", "outcome": "send",    "attempt_count": 2, "notes": null },
    { "grade": "V5", "outcome": "project", "attempt_count": 6, "notes": "close" }
  ],
  "baseline": {
    "window_days": 30,
    "sessions_count": 12,
    "send_rate": 0.32,
    "top_grade": "V5",
    "total_attempts": 180
  },
  "max_output_chars": 240
}
```

**Response (200):**

```jsonc
{
  "text": "Solid V4 send and a real go at V5 — keep that volume.",
  "usage": {
    "input_tokens": 412,
    "output_tokens": 28,
    "model": "gpt-5.4-nano",
    "duration_ms": 1830
  }
}
```

### `POST /weekly-report`

Bearer-auth: `Authorization: Bearer ${SIDECAR_SECRET}` (same value the
Convex action holds).

**Request** — see `src/schemas.py` (`WeeklyReportRequest`).
The single source of truth for the wire shape is the Pydantic model.
`docs/architecture.md` documents the same schema for the Convex side.

**Response** — `WeeklyReportResponse`:

```jsonc
{
  "narrative_md": "## This week …",
  "stats": {
    "sends_count": 14, "top_grade": "V5", "send_rate": 0.31,
    "total_attempts": 45, "gyms_visited": 2, "longest_send_streak": 4,
    "send_rate_delta_prev_week": 0.07, "send_rate_delta_baseline": 0.02,
    "top_grade_delta": 1
  },
  "model": "gpt-5.4-nano",
  "duration_ms": 14230,
  "input_tokens": 2870,
  "output_tokens": 442
}
```

**Errors:**

- `401 Unauthorized` — `{ "error": "unauthorized" }` when bearer mismatch.
- `422 Unprocessable Entity` — FastAPI validation error (Pydantic).
- `5xx` — `{ "error": "<message>" }`. Convex stores the message in
  `weeklyReports.error` and sets `status='err'`.

## LangGraph topology

Two graphs, both strict-typed Pydantic state, no `dict[str, Any]` between
nodes.

```
weekly-report:
  START → load_payload → analyze_stats → synthesize_narrative → END

summarize-session:
  START → load_payload → format_prompt → synthesize → END
```

See `apps/topout/diagrams/llm-flows.drawio` for the visual.

## Observability — Langfuse

The sidecar wires `langfuse.langchain.CallbackHandler` into every LLM call.
Each graph node also shows up as a Langfuse observation because LangGraph
runs nodes through the same LangChain runnable plumbing. Each request is
wrapped in `propagate_attributes(user_id, session_id, tags)` so the trace
groups correctly in the Langfuse UI.

Env vars (all optional — empty = tracing disabled, sidecar still runs):

| Variable | Local dev | Prod |
|---|---|---|
| `LANGFUSE_HOST` | `http://langfuse-web:3000` | per-app Langfuse subdomain |
| `LANGFUSE_PUBLIC_KEY` | grab from local UI | `provision-langfuse-org.sh` |
| `LANGFUSE_SECRET_KEY` | grab from local UI | `provision-langfuse-org.sh` |
| `LANGFUSE_ENVIRONMENT` | `development` | `production` |

See `project_langfuse_per_app_isolation` for the cloud provisioning flow.

## Conventions

- **Settings** via pydantic-settings (`src/core/settings.py`) — reads `.env`
  next to `pyproject.toml`. Never hard-code keys.
- **Auth dependency** in `src/auth.py` returns `None` on success, raises
  `HTTPException(401)` on failure. Applied to every route except `/health`.
- **LLM SDK isolated** to `src/llm/client.py` — mirror of the TS
  `convex/llm/client.ts`. Vertex AI swap is a one-file change.
- **Prompts** as module-level constants in `src/llm/prompts/*.py`. Never
  inline a prompt in a node.
- **No global state.** `GRAPH = build_graph()` at module load is fine
  (LangGraph compiles graphs as immutable); request-scoped data lives in
  the state model.

## Files

```
sidecar/
├── pyproject.toml
├── poetry.lock                  # generated on first install
├── run.sh                       # uvicorn launcher
├── README.md                    # this file
├── .env.example                 # committed; .env is gitignored
└── src/
    ├── main.py                          # FastAPI app factory
    ├── auth.py                          # bearer_auth dependency
    ├── schemas.py                       # Pydantic v2 request/response models
    ├── routes/
    │   ├── health.py                    # GET  /health
    │   ├── summarize_session.py         # POST /summarize-session
    │   └── weekly_report.py             # POST /weekly-report
    ├── graph/
    │   ├── state.py                     # WeeklyReportState (typed Pydantic)
    │   ├── nodes.py                     # weekly-report nodes
    │   ├── weekly_report.py             # weekly-report StateGraph
    │   └── summarize_session.py         # summarize-session State + StateGraph
    ├── llm/
    │   ├── client.py                    # ChatOpenAI gateway; one function per call type
    │   └── prompts/
    │       ├── weekly_report.py
    │       └── summarize_session.py
    ├── observability/
    │   └── langfuse.py                  # singleton client + CallbackHandler (or None)
    └── core/
        ├── settings.py
        └── logger.py
```

## Tests

```bash
poetry run pytest
```

The BackendTester writes:
- A **contract test** that sends a TS-shaped fixture request and asserts
  the Pydantic models accept it without losses, and the response shape
  matches what the Convex action expects to parse back.
- A **happy path** test that mocks the OpenAI client and runs the full
  graph end-to-end.
- A **401** test for the bearer-auth dependency.

## Deferred

Per the spec (`docs/specs/topout/weekly-report.md`):

- Cron schedule — Convex `crons.weekly(...)` deferred until the sidecar
  is hosted (Cloud Run is the planned target; not v1).
- Streaming narrative — full-response sync only.
- Async-callback pattern (sidecar POSTs result back via Convex HTTP) — sync only.
- Multi-week / monthly reports — one week per report.

## Cloud deployment

Not in v1. When this moves to Cloud Run, CloudEngineer adds:
- `apps/topout/sidecar/Dockerfile`
- `terraform/topout/` module (Artifact Registry + Cloud Run service)
- Cloud Run env vars sourced from the per-app Secret Manager

Until then: `./run.sh` on the developer's machine, called by the local
Convex action via `PYTHON_SIDECAR_URL=http://host.docker.internal:8000`.
