# topout / sidecar

Python FastAPI + LangGraph service that powers the **weekly coaching report**
feature. Owns the heavyweight analytics work that doesn't belong in a Convex
action:

- pandas time-series aggregation over a week's sessions/attempts
- 3-node LangGraph pipeline (`load_payload` → `analyze_stats` → `synthesize_narrative`)
- OpenAI `gpt-5.4-nano` for the markdown narrative

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

```
START → load_payload → analyze_stats → synthesize_narrative → END
```

Single typed Pydantic `WeeklyReportState`. No `dict[str, Any]` in the graph.
See `apps/topout/diagrams/weekly-report-graph.drawio` for the visual.

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
    ├── main.py                  # FastAPI app factory
    ├── auth.py                  # bearer_auth dependency
    ├── schemas.py               # Pydantic v2 request/response models
    ├── routes/
    │   ├── health.py            # GET /health
    │   └── weekly_report.py     # POST /weekly-report
    ├── graph/
    │   ├── weekly_report.py     # StateGraph build + GRAPH module-level
    │   ├── state.py             # WeeklyReportState
    │   └── nodes.py             # load_payload, analyze_stats, synthesize_narrative
    ├── llm/
    │   ├── client.py
    │   └── prompts/
    │       └── weekly_report.py
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
