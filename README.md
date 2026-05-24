# TopOut

A bouldering training coach for climbers-who-code. Log V-scale sessions,
watch your dashboard update live, get an AI-written weekly coaching report.

> Built as a portfolio piece exercising **Next.js + Convex + Python LangGraph**
> end-to-end. The repo is public — no secrets are committed.

## Features

| | What it does |
|---|---|
| **Sign in** | Email + password via Convex Auth. No OAuth, no email verification — keeps the surface minimal. |
| **Log a session** | Date, gym, perceived effort, attempts (V-grade + outcome + count + optional note). One mutation writes session + attempts atomically. |
| **Live dashboard** | 4 KPI tiles + 4 charts (send pyramid, weekly volume, grade attempt distribution, send rate trend). Updates in <500ms via Convex reactivity. |
| **Per-session AI summary** | A Convex action calls OpenAI (`gpt-5.4-nano`) right after each `createSession`. The 1–2-sentence coaching blurb shows up in the session detail. |
| **Follow a partner** | Asymmetric follow. View a partner's dashboard live — the same `Dashboard` component, parameterised by their `userId`. The reactive payoff is visible in real-time. |
| **Weekly report** | A Convex action POSTs the week's data to a Python FastAPI sidecar. The sidecar runs a 3-node LangGraph (`load_payload` → `analyze_stats` (pandas) → `synthesize_narrative` (OpenAI)) and returns a markdown narrative. |
| **Seed data** | `pnpm seed` creates two demo users with 36 sessions each over the last 84 days. A fresh clone becomes a working demo in seconds. |

Deferred for later: photo-beta multimodal LLM, goal tracking, mobile app,
video analysis.

## Architecture at a glance

Three pieces, one repo:

- **Convex** — auth, database, reactive queries, mutation orchestration. Schedules the per-session summary after `createSession`.
- **Python sidecar** — the single LLM gateway. Both AI features (session summary, weekly report) route through it. No OpenAI SDK in Convex. Swap the model in `sidecar/src/llm/client.py` and nothing else changes.
- **Langfuse** — every LLM call and every LangGraph node transition is traced. Keys optional; missing keys = graceful no-op.

Diagrams: [`diagrams/`](./diagrams/) (data model, service topology, LangGraph topology).

## Run locally

Prereqs: Node 24, pnpm via Corepack, Python 3.12+, Poetry.

```bash
# Clone (topout is its own repo, not the monorepo)
git clone https://github.com/SzymonSmagowski/topout.git
cd topout
pnpm install
cd frontend && cp .env.local.example .env.local && cd ..
cd sidecar  && cp .env.example .env             && cd ..
cd sidecar  && poetry install                   && cd ..
```

**Fill in the env files before running:**
- `frontend/.env.local` — `NEXT_PUBLIC_CONVEX_URL` (from step below)
- `sidecar/.env` — `OPENAI_API_KEY`, `SIDECAR_SECRET` (generate: `openssl rand -hex 32`)
- Convex deployment — `npx convex env set OPENAI_API_KEY …` and `npx convex env set SIDECAR_SECRET …` (same secret as sidecar)

**One-time bootstrap** (generates `convex/_generated/`):
```bash
cd frontend && pnpm exec convex dev   # prompts login + provisions dev deployment
# After "Convex functions ready" prints, Ctrl-C is fine.
```

**Day to day — one command starts everything:**
```bash
./dev.sh
```

Starts frontend (`:3000`), Convex dev server (schema sync), and Python sidecar (`:8000`).

**Optional: Langfuse tracing** — open `http://localhost:3001` (login: `dev@example.com` / `devpassword`), create a project `topout-sidecar`, copy the API key pair into `sidecar/.env`. Leave the keys empty to skip tracing.

Open `http://localhost:3000`. The first thing you'll see is a sign-in screen; register your own account or use the seed accounts below.

## Seed accounts

After `./dev.sh` is running (frontend + Convex dev), in a separate terminal:

```bash
pnpm seed
```

This creates two demo accounts with 84 days of realistic V3→V5 and V4→V6
training data, plus mutual follows so the partner-follow feature is
demo-ready.

| | Email | Password |
|---|---|---|
| Alex (V3 → V5 arc) | `seed-alex@topout.local` | `seed-demo-pw` |
| Sam (V4 → V6 arc)  | `seed-sam@topout.local`  | `seed-demo-pw` |

These credentials are intentionally documented — the seed accounts are
demo identities, not personal accounts. The seed script refuses to run
against a production Convex deployment.

## Tests

```bash
# Frontend unit tests (Vitest — no live Convex needed)
cd frontend && pnpm test

# Frontend E2E (Playwright — requires ./dev.sh running first)
cd frontend && pnpm test:e2e

# Sidecar tests (pytest — no real API key needed, stubs ChatOpenAI)
cd sidecar && poetry run pytest -q
```

74 tests total, all finish under 2 seconds.

## Stack

- **Frontend** — Next.js 15 (App Router) + Tailwind v4 + Recharts + `react-markdown`. Deployed to Vercel.
- **Backend** — Convex (DB + queries + mutations + actions + reactive subscriptions + Convex Auth Password provider). Deployed to Convex Cloud.
- **Sidecar** — Python 3.14 + FastAPI + LangGraph 1.x + pandas + OpenAI SDK. Local-only for v1; Cloud Run deferred.
- **LLM** — OpenAI `gpt-5.4-nano` via `OPENAI_API_KEY` + `OPENAI_MODEL`. Abstracted behind `sidecar/src/llm/client.py` — one file to swap the model across all AI features.

## Repository layout

```
topout/
├── frontend/            Next.js app (the user-facing surface)
├── convex/              Schema + queries + mutations + actions
├── sidecar/             Python FastAPI + LangGraph service
├── scripts/seed.ts      `pnpm seed` entry point
├── diagrams/            Architecture diagrams (.drawio + .png)
├── docs/architecture.md API contract + design rationale
├── dev.sh               Starts all 3 services together
├── package.json         Workspace root
└── README.md            (this file)
```

## What's not in the repo (intentionally)

- **`.env.local`, `.env`** — every secret. `.env.local.example` / `.env.example`
  are committed so a fresh clone knows what variables to set.
- **Convex deploy keys** — set via the Convex dashboard / `npx convex env set`.
- **OpenAI API key** — set in Convex env (`npx convex env set OPENAI_API_KEY …`)
  and in `sidecar/.env`. Never appears in source.

## Code quality

The project's TypeScript bar lives in
[`docs/architecture.md`](./docs/architecture.md) and the parent
[`docs/specs/topout/_manifest.md`](https://github.com/SzymonSmagowski/Claude-Code-Skills/blob/main/docs/specs/topout/_manifest.md)
in the autonomous-dev-pipeline repo. Highlights:

- `strict: true`, `noUncheckedIndexedAccess: true`
- No `any`, no `enum`
- Convex `Id<'table'>` branded types everywhere
- Discriminated unions for state, typed `ConvexError` payloads
- Python mirror: Pydantic v2 + `mypy --strict` + ruff + black

## License

MIT.
