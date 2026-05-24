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

## Architecture

Three pieces, one repo. Convex is the source of truth for data and runs all
reactive queries; the Python sidecar is invoked synchronously by a Convex
action only for the weekly report, where pandas-based time-series work and
LangGraph orchestration earn their keep over plain Convex actions. The
sidecar holds no Convex client — data flows in via the HTTP POST body.

Diagrams: [`diagrams/`](./diagrams/) (data model, service topology,
LangGraph topology).

## Run locally

Prereqs: Node 24, pnpm via Corepack, Python 3.12+, Poetry.

```bash
# One-time
git clone https://github.com/SzymonSmagowski/topout.git
cd topout
pnpm install
cd frontend && cp .env.local.example .env.local && cd ..
cd sidecar  && cp .env.example .env             && cd ..

# Fill in the env files: NEXT_PUBLIC_CONVEX_URL (from `npx convex dev`),
# OPENAI_API_KEY (in the sidecar .env and in Convex via `npx convex env set`),
# and matching SIDECAR_SECRET on both sides.

cd frontend && pnpm exec convex dev   # first run prompts to create a dev deployment
cd ../sidecar && poetry install

# Day to day — one command starts everything:
./dev.sh
```

Open `http://localhost:3000`. The first thing you'll see is a sign-in
screen; either register your own account or use the seed accounts below.

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

## Stack

- **Frontend** — Next.js 15 (App Router) + Tailwind v4 + Recharts + `react-markdown`. Deployed to Vercel.
- **Backend** — Convex (DB + queries + mutations + actions + reactive subscriptions + Convex Auth Password provider). Deployed to Convex Cloud.
- **Sidecar** — Python 3.14 + FastAPI + LangGraph 1.x + pandas + OpenAI SDK. Local-only for v1; Cloud Run deferred.
- **LLM** — OpenAI `gpt-5.4-nano` via `OPENAI_API_KEY` + `OPENAI_MODEL`. Provider abstracted behind `convex/llm/client.ts` and `sidecar/src/llm/client.py` so a Gemini/Vertex AI swap is a one-file change.

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
