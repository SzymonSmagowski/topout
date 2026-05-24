# TopOut — Technical Architecture

- **App:** topout
- **Author:** Architect agent
- **Date:** 2026-05-24
- **Status:** handoff — BackendDeveloper + FrontendDeveloper implement from here
- **Scope:** all 7 ✓ spec'd features (`auth`, `sessions`, `seed-data`, `live-dashboard`, `summarize-session`, `follow-partner`, `weekly-report`)

This document is the implementation contract. The Convex schema in
`apps/topout/convex/schema.ts` is the data model in machine-readable form;
everything below describes the queries, mutations, actions, HTTP endpoints
and authorization helpers built on top of it.

---

## 1. Stack at a glance

| Layer | Technology | Hosting (v1) |
|---|---|---|
| Frontend | Next.js 15 App Router + Tailwind v4 + Recharts + `react-markdown` | Vercel |
| Auth + DB + API | Convex (queries / mutations / actions / scheduler / reactive subscriptions) + Convex Auth Password provider | Convex Cloud |
| Analytics + LangGraph LLM | FastAPI + LangGraph 1.x + pandas + OpenAI SDK — Python 3.14 sidecar | local (`uvicorn` via `dev.sh`) — Cloud Run deferred |
| LLM | OpenAI `gpt-5.4-nano` via `OPENAI_API_KEY` + `OPENAI_MODEL` env vars | OpenAI |

The repo at `github.com/SzymonSmagowski/topout` is **public**. Every secret
lives in gitignored `.env.local` / `.env` files. `.env.local.example` files
are committed so a fresh clone knows what variables exist without exposing
values.

---

## 2. Directory layout

```
apps/topout/
├── README.md                        # portfolio-visitor-facing run guide
├── CLAUDE.md                        # agent navigation guide
├── dev.sh                           # starts frontend + convex dev + sidecar together
├── package.json                     # workspace root scripts (seed, convex commands)
│
├── frontend/                        # Next.js 15 app — see frontend/CLAUDE.md
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/sign-in/page.tsx
│   │   │   ├── (auth)/register/page.tsx
│   │   │   ├── (app)/dashboard/page.tsx
│   │   │   ├── (app)/sessions/page.tsx
│   │   │   ├── (app)/sessions/new/page.tsx
│   │   │   ├── (app)/sessions/[sessionId]/page.tsx
│   │   │   ├── (app)/sessions/[sessionId]/edit/page.tsx
│   │   │   ├── (app)/partners/page.tsx
│   │   │   ├── (app)/partners/[userId]/page.tsx
│   │   │   ├── (app)/partners/[userId]/sessions/[sessionId]/page.tsx
│   │   │   ├── (app)/reports/page.tsx
│   │   │   ├── (app)/reports/[reportId]/page.tsx
│   │   │   ├── design-preview/page.tsx              # already exists
│   │   │   ├── providers.tsx                        # already exists
│   │   │   ├── layout.tsx                           # already exists
│   │   │   └── globals.css                          # already exists
│   │   ├── components/
│   │   │   ├── AppShell.tsx                         # promoted from design-preview/_components
│   │   │   ├── Dashboard.tsx                        # the reusable one — userId prop
│   │   │   ├── SummaryBanner.tsx
│   │   │   ├── GradePill.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   ├── SessionForm.tsx
│   │   │   ├── PartnerRow.tsx
│   │   │   ├── ReportCard.tsx
│   │   │   ├── SidecarHealthBanner.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── Logo.tsx
│   │   ├── lib/
│   │   │   ├── grades.ts                            # already exists
│   │   │   ├── grade-colors.ts                      # already exists
│   │   │   ├── utils.ts                             # already exists
│   │   │   └── ids.ts                               # DELETED once Convex client lands
│   │   └── middleware.ts                            # convexAuthNextjsMiddleware route guard
│   ├── next.config.ts
│   ├── tsconfig.json                                # already exists
│   ├── package.json                                 # already exists; add convex + @convex-dev/auth
│   └── .env.local.example                           # NEW — commit, never .env.local
│
├── convex/                          # Convex functions — see convex/CLAUDE.md
│   ├── schema.ts                    # SoT data model (Architect-written; do not refactor)
│   ├── auth.ts                      # Password provider config (one-file swap point)
│   ├── auth.config.ts
│   ├── http.ts                      # Convex Auth HTTP routes
│   ├── lib/
│   │   ├── enums.ts                 # V_GRADES, OUTCOMES, vGrade, vOutcome, … (Architect-written)
│   │   ├── auth.ts                  # requireUser, requireOwner, requireFollowing helpers
│   │   ├── time.ts                  # windowStart(window, now), weekStartFor(date)
│   │   └── errors.ts                # typedError({ kind }) sugar
│   ├── gyms.ts                      # listByPrefix, ensureByName
│   ├── sessions.ts                  # create, update, delete, listOwn, getById, listForUser
│   ├── attempts.ts                  # rare direct queries (always indexed bySession)
│   ├── dashboard.ts                 # kpiStats, sendPyramid, weeklyVolume, gradeAttemptDist, sendRateTrend
│   ├── follows.ts                   # follow, unfollow, listPartners, listFollowing, listFollowers
│   ├── summarize.ts                 # internal action `run`, public `retrySummary` mutation
│   ├── reports.ts                   # generateReport (action), listReports, getReport
│   ├── seed.ts                      # internal mutations called by scripts/seed.ts
│   ├── llm/
│   │   ├── client.ts                # provider abstraction (the 10-line swap point)
│   │   └── prompts/
│   │       └── summarize-session.ts # const string only
│   └── _generated/                  # auto-generated; gitignored
│
├── sidecar/                         # Python FastAPI service — see sidecar/README.md
│   ├── pyproject.toml
│   ├── poetry.lock
│   ├── run.sh                       # uvicorn launcher
│   ├── README.md                    # how to run + Pydantic contract
│   ├── .env.example                 # NEW — commit, never .env
│   └── src/
│       ├── __init__.py
│       ├── main.py                  # FastAPI app factory
│       ├── auth.py                  # bearer_auth FastAPI dependency
│       ├── schemas.py               # Pydantic v2 request/response models
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── health.py            # GET /health
│       │   └── weekly_report.py     # POST /weekly-report
│       ├── graph/
│       │   ├── __init__.py
│       │   ├── weekly_report.py     # the 3-node StateGraph
│       │   ├── state.py             # WeeklyReportState pydantic model
│       │   └── nodes.py             # load_payload, analyze_stats, synthesize_narrative
│       ├── llm/
│       │   ├── __init__.py
│       │   ├── client.py            # mirror of convex/llm/client.ts (Python side)
│       │   └── prompts/
│       │       ├── __init__.py
│       │       └── weekly_report.py # const SYSTEM_PROMPT
│       └── core/
│           ├── __init__.py
│           ├── settings.py          # pydantic-settings — SIDECAR_SECRET, OPENAI_*, PORT
│           └── logger.py
│
├── scripts/
│   └── seed.ts                      # `pnpm seed` entry point — uses ConvexHttpClient
│
└── diagrams/
    ├── convex-schema-erd.drawio     # data model — Architect
    ├── service-topology.drawio      # system context — Architect
    └── weekly-report-graph.drawio   # LangGraph topology — Architect
```

---

## 3. Authorization — three helpers, one consistent story

All three live in `convex/lib/auth.ts`. Every public Convex function MUST go
through one of them before touching `ctx.db`. Add a contract test in
BackendTester that greps each handler in `convex/sessions.ts`, `convex/dashboard.ts`,
and `convex/follows.ts` for one of these calls.

```ts
// convex/lib/auth.ts — signatures only

import type { Id } from '../_generated/dataModel';
import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server';

/**
 * Returns the current user's id. Throws ConvexError({ kind: 'not_authenticated' })
 * if the request has no auth. Use in every query/mutation/action that needs
 * a user identity (i.e. essentially everything except gyms.listByPrefix).
 */
export function requireUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<'users'>>;

/**
 * Loads a session and asserts the caller is its owner. Throws
 * ConvexError({ kind: 'session_not_found' }) or { kind: 'not_session_owner' }.
 * Use in updateSession, deleteSession, retrySummary, generateReport.
 */
export function requireOwner(
  ctx: MutationCtx | ActionCtx,
  sessionId: Id<'sessions'>,
): Promise<{ userId: Id<'users'>; session: Doc<'sessions'> }>;

/**
 * Asserts the caller follows `targetUserId` (or is `targetUserId`). Throws
 * ConvexError({ kind: 'not_following' }) on miss. Use in every query that
 * exposes another user's data — dashboard queries when `userId !== viewer`,
 * partner session list, partner session detail.
 *
 * The `viewer === target` shortcut lets the dashboard component re-use the
 * same queries for self and partner views.
 */
export function requireFollowing(
  ctx: QueryCtx,
  targetUserId: Id<'users'>,
): Promise<void>;
```

The `ConvexError` payload shape is always `{ kind: ErrorKind, message?: string }`
where `ErrorKind` is the `as const` union in `convex/lib/enums.ts`.
**Never throw bare strings.** UI code switches on `error.data.kind`.

---

## 4. LLM provider abstraction

> The brief: "the Gemini/Vertex AI swap before the interview is a 10-line change".

### 4.1 TypeScript side — `convex/llm/client.ts`

```ts
// convex/llm/client.ts — signatures only.
// All OpenAI SDK imports happen in THIS FILE ONLY. Nowhere else.

export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly model: string;
  readonly durationMs: number;
}

export interface LlmResult {
  readonly text: string;
  readonly usage: LlmUsage;
}

/**
 * One function per call type so each prompt's I/O is named at the call site.
 * Today: just `summarizeSession`. Future calls (e.g. multimodal beta) get a
 * second function here; they don't add a second SDK import elsewhere.
 *
 * Reads OPENAI_API_KEY and OPENAI_MODEL from Convex env vars (configured via
 * `npx convex env set`). The `model` env var defaults to 'gpt-5.4-nano' if
 * unset — matches the manifest.
 */
export async function summarizeSession(input: {
  readonly systemPrompt: string;
  readonly payload: unknown;     // JSON-serializable; the action builds it
  readonly maxOutputChars: number;
}): Promise<LlmResult>;
```

To swap to Vertex AI: replace the body of `summarizeSession` with a
`@google-cloud/vertexai` call. Public types stay identical; no caller
changes.

### 4.2 Python side — `sidecar/src/llm/client.py`

Mirrors the TS shape:

```python
# sidecar/src/llm/client.py — signatures only.

from dataclasses import dataclass

@dataclass(frozen=True)
class LlmUsage:
    input_tokens: int
    output_tokens: int
    model: str
    duration_ms: int

@dataclass(frozen=True)
class LlmResult:
    text: str
    usage: LlmUsage

async def synthesize_weekly_narrative(
    system_prompt: str,
    user_payload: dict,             # serialized stats blob
    max_output_chars: int = 4000,
) -> LlmResult: ...
```

Same env vars: `OPENAI_API_KEY`, `OPENAI_MODEL`. Same swap pattern.

---

## 5. Convex API surface (every public + internal function)

Validators are the SoT — TS types derive from `v.infer<typeof …>` so they
cannot drift. Where a function returns a fully-typed `Doc<'table'>`, the
"output" cell below names the table.

### 5.1 `convex/gyms.ts`

| Kind | Name | Input validator | Output |
|---|---|---|---|
| query | `listByPrefix` | `{ prefix: v.string() }` | `readonly Doc<'gyms'>[]` (≤ 12, sorted by name) |
| mutation | `ensureByName` | `{ name: v.string(), city: v.optional(v.string()) }` | `{ gymId: Id<'gyms'>, created: boolean }` |

`ensureByName` is what the log-session form calls when the user types a new
gym. It looks up by exact case-insensitive name match via the `byName` index;
inserts if missing.

### 5.2 `convex/sessions.ts`

| Kind | Name | Input validator | Output |
|---|---|---|---|
| mutation | `createSession` | `{ date, gymId, perceivedEffort, notes?, durationMinutes?, attempts: AttemptInput[] }` | `{ sessionId: Id<'sessions'> }` |
| mutation | `updateSession` | `{ sessionId, date, gymId, perceivedEffort, notes?, durationMinutes?, attempts: AttemptInput[] }` | `{ sessionId: Id<'sessions'> }` |
| mutation | `deleteSession` | `{ sessionId: v.id('sessions') }` | `null` |
| query | `listOwn` | `{ limit?: v.number() }` | `readonly SessionWithSummary[]` |
| query | `listForUser` | `{ userId: v.id('users'), limit?: v.number() }` | `readonly SessionWithSummary[]` (via `requireFollowing`) |
| query | `getById` | `{ sessionId: v.id('sessions') }` | `SessionDetail \| null` (via `requireFollowing` if `session.userId !== viewer`) |

`AttemptInput` validator:
```ts
v.object({
  grade: vGrade,
  outcome: vOutcome,
  attemptCount: v.number(),       // mutation enforces ≥ 1
  notes: v.optional(v.string()),
})
```

`SessionWithSummary` = the session row + a hydrated `gymName: string` + an
aggregated `topGrade: VGrade | null` and `sendCount: number` derived from
its attempts in the same query call (no client-side aggregation).

`createSession` body (BackendDeveloper TODO):
1. `await requireUser(ctx)`.
2. Validate `date <= today` (server time, UTC midnight).
3. Validate `1 <= perceivedEffort <= 10`.
4. Validate `attempts.length >= 1`.
5. Validate every `attemptCount >= 1`.
6. Insert `sessions` row with `summary: null, summaryStatus: 'pending', summaryError: null`.
7. Insert each `attempts` row referencing the new `sessionId`.
8. `await ctx.scheduler.runAfter(0, internal.summarize.run, { sessionId });`
9. Return `{ sessionId }`.

`updateSession`:
1. `await requireOwner(ctx, sessionId)`.
2. Re-run validation block.
3. Update session fields; **reset `summary` to null, `summaryStatus` to `'pending'`, `summaryError` to null.**
4. Delete all `attempts` for this `sessionId`, insert the new ones.
5. `await ctx.scheduler.runAfter(0, internal.summarize.run, { sessionId });`.

`deleteSession`:
1. `await requireOwner(ctx, sessionId)`.
2. Delete all `attempts` with `bySession` index match.
3. Delete the session row.

### 5.3 `convex/dashboard.ts`

All take `{ userId: v.id('users'), window: vTimeWindow }`. Each calls
`requireFollowing(ctx, userId)` (which no-ops when viewer === target).

| Name | Output shape |
|---|---|
| `kpiStats` | `{ sessionsCount: number; topGradeEver: VGrade \| null; topGradeEverDate: number \| null; sendRate: number; totalAttempts: number }` |
| `sendPyramid` | `readonly { grade: VGrade; sends: number }[]` (ordered VB→V17, zero rows omitted) |
| `weeklyVolume` | `readonly { weekStart: number; sessions: number; attempts: number }[]` |
| `gradeAttemptDist` | `readonly { grade: VGrade; attempts: number }[]` |
| `sendRateTrend` | `readonly { weekStart: number; sendRate: number; baselineSendRate: number }[]` |

All aggregation happens in the query function (spec: "client just renders").
Use `byUserAndDate` index for the window bound, then `bySession` to pull
attempts per session. **Top grade ever** ignores the window and scans all
sessions for that user — small N, no index needed beyond `byUserAndDate`.

### 5.4 `convex/follows.ts`

| Kind | Name | Input | Output |
|---|---|---|---|
| mutation | `follow` | `{ followeeId: v.id('users') }` | `{ followId: Id<'follows'> }` |
| mutation | `unfollow` | `{ followeeId: v.id('users') }` | `null` |
| query | `listPartners` | `{}` | `readonly PartnerRow[]` — all users except self, with `isFollowing: boolean`, `gradeRange`, `lastSessionAt`. |
| query | `listFollowing` | `{}` | `readonly Doc<'users'>[]` |
| query | `listFollowers` | `{ userId: v.id('users') }` | `readonly Doc<'users'>[]` |

`follow` body:
1. `viewerId = await requireUser(ctx)`.
2. If `viewerId === followeeId` → throw `ConvexError({ kind: 'self_follow' })`.
3. Look up via `byFollowerAndFollowee` index. If exists → throw `ConvexError({ kind: 'already_following' })`.
4. Insert `{ followerId: viewerId, followeeId, createdAt: Date.now() }`.

`unfollow` is idempotent: deletes if found, no-ops if not.

### 5.5 `convex/summarize.ts`

| Kind | Name | Input | Output | Visibility |
|---|---|---|---|---|
| internalAction | `run` | `{ sessionId: v.id('sessions') }` | `null` | scheduler only |
| mutation | `retrySummary` | `{ sessionId: v.id('sessions') }` | `null` | public |

`internal.summarize.run`:
1. Load session via `ctx.runQuery(internal.sessions.getInternal, { sessionId })`.
2. If `summaryStatus === 'ok'` → return (idempotent guard for double-fire).
3. Load attempts via `internal.attempts.bySessionInternal`.
4. Load 30-day baseline via `internal.dashboard.baselineInternal`.
5. Build prompt payload (JSON-serializable; ≤ 1500 input tokens).
6. Call `llm.summarizeSession({ systemPrompt: SUMMARIZE_PROMPT, payload, maxOutputChars: 240 })`.
7. On success → `ctx.runMutation(internal.sessions.patchSummary, { sessionId, summary, status: 'ok' })`.
8. On error → patch with `summaryStatus: 'err'`, `summaryError: truncate(message, 200)`.
9. Log `{ sessionId, durationMs, inputTokens, outputTokens, model }` to `console.log`.

`retrySummary`:
1. `await requireOwner(ctx, sessionId)`.
2. Rate-limit: reject with `ConvexError({ kind: 'summary_retry_rate_limited' })` if
   `Date.now() - session._creationTime < 5_000` AND the session has been retried before.
   Implementation: track last-retry timestamp in memory via the session's
   `updatedAt` heuristic — keep simple, no extra table.
3. Patch `summary: null, summaryStatus: 'pending', summaryError: null`.
4. `await ctx.scheduler.runAfter(0, internal.summarize.run, { sessionId })`.

### 5.6 `convex/reports.ts`

| Kind | Name | Input | Output |
|---|---|---|---|
| action | `generateReport` | `{ weekStart: v.number() }` | `{ reportId: Id<'weeklyReports'> }` |
| query | `listReports` | `{}` | `readonly Doc<'weeklyReports'>[]` (caller's only, byUserAndCreated desc) |
| query | `getReport` | `{ reportId: v.id('weeklyReports') }` | `Doc<'weeklyReports'> \| null` |

`generateReport`:
1. `userId = await requireUser(ctx)`.
2. Compute `weekEnd = weekStart + 7 * 86_400_000 - 1`.
3. `ctx.runMutation(internal.reports.upsertPending, { userId, weekStart, weekEnd })`
   — uses `byUserAndWeekStart` to upsert.
4. Load 7-day sessions+attempts and 30-day baseline via internal queries.
5. POST to `process.env.PYTHON_SIDECAR_URL + '/weekly-report'` with
   `Authorization: Bearer ${process.env.SIDECAR_SECRET}` and `Content-Type: application/json`.
6. On 2xx → patch row with `status: 'ok'`, narrative, statsJson, model, generatedAt, error: null.
7. On non-2xx or fetch throw → patch with `status: 'err'`, `error: truncate(message, 500)`.
8. Return `{ reportId }`.

The action NEVER stays in 'pending' on the action's own crash path —
wrap the sidecar call in `try { … } catch (e) { patch(err) }`.

### 5.7 `convex/seed.ts` — internal mutations

The seed script doesn't talk to public mutations because it needs to bypass
date-validation and atomically wipe seed data. All exports here are
`internalMutation` / `internalAction`, called from `scripts/seed.ts` via
`ConvexHttpClient.action(internal.seed.run, …)` with a deploy key.

| Kind | Name | Purpose |
|---|---|---|
| internalAction | `run` | Top-level orchestrator. Calls everything below in order. |
| internalMutation | `assertNonProd` | Reads `process.env.CONVEX_DEPLOYMENT` from action env; throws `ConvexError({ kind: 'production_deployment_blocked' })` if the deployment name doesn't match an allowlist OR isn't prefixed `dev:`. |
| internalMutation | `wipeSeedUsers` | Deletes all `weeklyReports`, `follows`, `attempts`, `sessions` for users with `isSeed: true`, then deletes the users themselves. Uses `byIsSeed` + `byUserAndDate` indexes. |
| internalMutation | `ensureGyms` | Idempotent insert of the 4 seed gyms. |
| internalAction | `createSeedUser` | Calls Convex Auth's signUp via `signIn(ctx, 'password', { flow: 'signUp', email, password, displayName })`, then patches `isSeed: true` on the new user row. |
| internalMutation | `insertSessionWithAttempts` | Like `createSession` but skips `date <= today` validation (seed dates are explicitly historical). Schedules `internal.summarize.run` only if `--llm-notes` flag is set — for the templated path, leaves `summaryStatus: 'pending'` so the dev can see the loading state, OR pre-populates with a templated string. **Decision: pre-populate with a templated summary** (avoids 72 LLM calls every seed run). |
| internalMutation | `insertFollow` | Plain insert; used twice for mutual follows. |

`scripts/seed.ts` shape:

```ts
// scripts/seed.ts — sketch
import { ConvexHttpClient } from 'convex/browser';
import { api, internal } from '../convex/_generated/api';

const url = process.env.CONVEX_URL ?? throwHelpful('CONVEX_URL missing');
const adminKey = process.env.CONVEX_ADMIN_KEY ?? throwHelpful(...);
const client = new ConvexHttpClient(url);
client.setAdminAuth(adminKey);

await client.action(internal.seed.run, { rngSeed: 42 /* or argv */ });
```

### 5.8 Validator → TS type derivation pattern

Every public function uses this idiom — show this in `convex/sessions.ts`
and replicate everywhere:

```ts
import { v, type Infer } from 'convex/values';

const createSessionArgs = v.object({
  date: v.number(),
  gymId: v.id('gyms'),
  perceivedEffort: v.number(),
  notes: v.optional(v.string()),
  durationMinutes: v.optional(v.number()),
  attempts: v.array(v.object({
    grade: vGrade,
    outcome: vOutcome,
    attemptCount: v.number(),
    notes: v.optional(v.string()),
  })),
});

export type CreateSessionArgs = Infer<typeof createSessionArgs>;

export const createSession = mutation({
  args: createSessionArgs,
  returns: v.object({ sessionId: v.id('sessions') }),
  handler: async (ctx, args) => { /* … */ },
});
```

---

## 6. Python sidecar HTTP contract

### 6.1 `GET /health`

- **Auth:** none (the frontend pings this without a token to detect "sidecar offline" — see `SidecarHealthBanner`).
- **Response (200):** `{ "status": "ok", "model": "gpt-5.4-nano" }`
- **Pydantic model:** `HealthResponse`.

### 6.2 `POST /weekly-report`

- **Auth:** `Authorization: Bearer ${SIDECAR_SECRET}` — rejected with 401 + `{ "error": "unauthorized" }` if missing/wrong.
- **Content-Type:** `application/json`.
- **Request — `WeeklyReportRequest`:**
  ```python
  class GymInPayload(BaseModel):
      name: str

  class AttemptInPayload(BaseModel):
      grade: VGradeLiteral          # Literal['VB', 'V0', …, 'V17']
      outcome: OutcomeLiteral       # Literal['flash', 'send', 'repeat', 'project', 'fall']
      attempt_count: int = Field(ge=1)
      notes: str | None = None

  class SessionInPayload(BaseModel):
      session_id: str                # opaque — sidecar never re-queries Convex
      date: int                      # epoch ms
      gym: GymInPayload
      perceived_effort: int = Field(ge=1, le=10)
      duration_minutes: int | None = None
      notes: str | None = None
      attempts: list[AttemptInPayload]

  class BaselineInPayload(BaseModel):
      window_days: int               # 30
      sessions_count: int
      send_rate: float               # 0..1
      top_grade: VGradeLiteral | None
      total_attempts: int

  class UserMetaInPayload(BaseModel):
      display_name: str
      user_id: str

  class WeeklyReportRequest(BaseModel):
      week_start: int                # epoch ms, Monday 00:00 UTC
      week_end: int                  # epoch ms
      user: UserMetaInPayload
      baseline: BaselineInPayload
      sessions: list[SessionInPayload]
  ```
- **Response (200) — `WeeklyReportResponse`:**
  ```python
  class WeeklyReportStats(BaseModel):
      sends_count: int
      top_grade: VGradeLiteral | None
      send_rate: float
      total_attempts: int
      gyms_visited: int
      longest_send_streak: int
      send_rate_delta_prev_week: float
      send_rate_delta_baseline: float
      top_grade_delta: int            # bucket-index delta

  class WeeklyReportResponse(BaseModel):
      narrative_md: str
      stats: WeeklyReportStats        # serialized to JSON string in Convex side
      model: str
      duration_ms: int
      input_tokens: int
      output_tokens: int
  ```
- **Error response (4xx/5xx):** `{ "error": "<message>" }` — Convex action stores this in `weeklyReports.error`.

**Convex side** of the contract: `convex/reports.ts` builds a TypeScript
mirror of these shapes inline. The contract test in BackendTester sends a
golden TS payload to the sidecar and asserts the response shape.

### 6.3 LangGraph topology — `sidecar/src/graph/weekly_report.py`

```python
# Conceptual outline (BackendDeveloper writes the bodies).

from langgraph.graph import START, END, StateGraph
from pydantic import BaseModel

from .state import WeeklyReportState  # full typed state model

def load_payload(state: WeeklyReportState) -> dict:
    """Validate the inbound dict against the request Pydantic model.
       Returns a dict patch into state with the validated request."""

def analyze_stats(state: WeeklyReportState) -> dict:
    """Pandas DataFrame over state.sessions + attempts.
       Returns a dict patch with state.stats populated."""

def synthesize_narrative(state: WeeklyReportState) -> dict:
    """Call llm.synthesize_weekly_narrative(prompt, payload).
       Returns a dict patch with state.narrative_md + usage."""

def build_graph():
    g = StateGraph(WeeklyReportState)
    g.add_node('load_payload', load_payload)
    g.add_node('analyze_stats', analyze_stats)
    g.add_node('synthesize_narrative', synthesize_narrative)
    g.add_edge(START, 'load_payload')
    g.add_edge('load_payload', 'analyze_stats')
    g.add_edge('analyze_stats', 'synthesize_narrative')
    g.add_edge('synthesize_narrative', END)
    return g.compile()

GRAPH = build_graph()
```

`WeeklyReportState` is a single Pydantic v2 BaseModel — no `dict[str, Any]`
anywhere in the pipeline. Use `Optional[T]` for fields populated by later
nodes.

---

## 7. ConvexError payload schema (UI contract)

```ts
type ConvexErrorPayload = {
  readonly kind: ErrorKind;          // from convex/lib/enums.ts
  readonly message?: string;         // human-readable; UI may fall back to a kind→copy map
};
```

UI components switch on `kind`:

```tsx
if (err instanceof ConvexError) {
  const { kind } = err.data;
  switch (kind) {
    case 'email_taken': return setFormError('That email is already registered.');
    case 'self_follow': return; // unreachable from UI
    case 'sidecar_unreachable':
      return setBannerError('Python sidecar offline. Run ./dev.sh.');
    // …
  }
}
```

---

## 8. Frontend route map

| Path | Auth | Page component | Key Convex calls |
|---|---|---|---|
| `/` | redirect | — | server-redirects to `/dashboard` (auth) or `/sign-in` (unauth) |
| `/sign-in` | guest | `SignInPage` | `useAuthActions().signIn('password', { flow: 'signIn', … })` |
| `/register` | guest | `RegisterPage` | `useAuthActions().signIn('password', { flow: 'signUp', email, password, displayName })` |
| `/dashboard` | required | `DashboardPage` | `<Dashboard userId={viewerId} />` |
| `/sessions` | required | `SessionListPage` | `api.sessions.listOwn` |
| `/sessions/new` | required | `SessionNewPage` | `api.gyms.listByPrefix`, `api.gyms.ensureByName`, `api.sessions.createSession` |
| `/sessions/[sessionId]` | required | `SessionDetailPage` | `api.sessions.getById`, `api.summarize.retrySummary` |
| `/sessions/[sessionId]/edit` | required | `SessionEditPage` | `api.sessions.getById`, `api.sessions.updateSession` |
| `/partners` | required | `PartnersPage` | `api.follows.listPartners`, `api.follows.follow`, `api.follows.unfollow` |
| `/partners/[userId]` | required | `PartnerDashboardPage` | `api.users.get`, `<Dashboard userId={partnerId} variant="partner" />`, `api.sessions.listForUser` |
| `/partners/[userId]/sessions/[sessionId]` | required | `PartnerSessionDetailPage` | `api.sessions.getById` (server enforces `requireFollowing`) |
| `/reports` | required | `ReportsPage` | `api.reports.listReports`, sidecar `GET /health` ping |
| `/reports/[reportId]` | required | `ReportDetailPage` | `api.reports.getReport`, `api.reports.generateReport` |
| `/design-preview` | guest | (existing) | none |

Route guarding via `convexAuthNextjsMiddleware` in `frontend/src/middleware.ts`:

```ts
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';

const isAuth = createRouteMatcher(['/sign-in', '/register']);
const isApp = createRouteMatcher([
  '/dashboard',
  '/sessions(.*)',
  '/partners(.*)',
  '/reports(.*)',
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated();
  if (isAuth(request) && authed) return nextjsMiddlewareRedirect(request, '/dashboard');
  if (isApp(request) && !authed) return nextjsMiddlewareRedirect(request, '/sign-in');
});

export const config = { matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'] };
```

---

## 9. Environment variables

Two committed example files; never their populated siblings.

### 9.1 `apps/topout/frontend/.env.local.example`

```bash
# Convex deployment URL. Get from `npx convex dev`'s first-run prompt.
NEXT_PUBLIC_CONVEX_URL=https://<your-dev-deployment>.convex.cloud

# Convex Auth — only used at build time by the Next.js client.
CONVEX_AUTH_LOG_LEVEL=info

# Sidecar URL probed by the /reports page's health banner. Defaults to localhost.
NEXT_PUBLIC_PYTHON_SIDECAR_URL=http://localhost:8000
```

### 9.2 Convex environment (set via `npx convex env set`, NOT a file)

```bash
# OpenAI
OPENAI_API_KEY=sk-...                # required
OPENAI_MODEL=gpt-5.4-nano            # default; override for evals

# Sidecar
PYTHON_SIDECAR_URL=http://host.docker.internal:8000   # dev
SIDECAR_SECRET=<32-char-hex>         # generate: openssl rand -hex 32

# Convex Auth (set automatically by convex auth setup; documented here for awareness)
JWT_PRIVATE_KEY=...
JWKS=...
SITE_URL=http://localhost:3000
```

### 9.3 `apps/topout/sidecar/.env.example`

```bash
# Server
PORT=8000
LOG_LEVEL=info

# Auth — MUST match the Convex env var SIDECAR_SECRET.
SIDECAR_SECRET=<paste-the-same-value-as-Convex>

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-nano
```

### 9.4 Seed-script environment (read by `scripts/seed.ts`, NOT committed)

```bash
# apps/topout/.env (gitignored)
CONVEX_URL=https://<your-dev-deployment>.convex.cloud
CONVEX_DEPLOY_KEY=<from `npx convex env get DEPLOY_KEY` or dashboard>
SEED_USER_PASSWORD=seed-demo-pw       # the documented seed password
```

The seed credentials (`seed-alex@topout.local` / `seed-demo-pw` and
`seed-sam@topout.local` / `seed-demo-pw`) are documented in the
top-level `README.md` because the seed users are explicitly demo identities,
not the developer's account.

---

## 10. Convex deployment naming + the seed prod-guard

Convex deployments are named `<env>:<slug>` — e.g. `dev:fluffy-otter-42`
on the developer's machine, `prod:topout` on Convex Cloud production.

The `pnpm seed` prod guard reads `process.env.CONVEX_DEPLOYMENT` (set
automatically by `convex dev` / `convex deploy`) and refuses to run unless
ONE of:
- The deployment name starts with `dev:`.
- The deployment name appears in the `ALLOWED_SEED_DEPLOYMENTS` env var
  (comma-separated allowlist — used to whitelist `prod:topout-demo`
  if/when that exists).

The guard is duplicated:
- **Client side** in `scripts/seed.ts` — refuses to call the action.
- **Server side** in `convex/seed.ts::assertNonProd` — refuses to execute.

Both fire `ConvexError({ kind: 'production_deployment_blocked' })`.

---

## 11. Open / clarification items

The orchestrator should flag these to the user before BackendDeveloper +
FrontendDeveloper start. Defaults are picked; just confirm.

1. **Seed summaries — templated, not LLM, by default.**
   To avoid 72 OpenAI calls per `pnpm seed` run, the seed inserts each
   session with `summaryStatus: 'ok'` and a templated narrative drawn from
   a curated pool. The spec's `--llm-notes` flag (in `seed-data.md` Could)
   already covers the opt-in path; I'm just clarifying the default also
   templates the *summary banner*, not just attempt notes. **Confirm or
   request `summaryStatus: 'pending'` so the dev sees the live update.**

2. **Dashboard cache strategy.** Convex queries are already reactive +
   per-result-cached. No client-side cache layer needed. Recharts'
   default 600ms animation gives the visible reactivity moment. No
   confirmation needed unless you want a different animation budget.

3. **`requireFollowing` self-shortcut.** I assumed `viewer === target → ok`.
   Confirm — otherwise the dashboard component needs a separate
   `myDashboard*` query family which doubles the code.

4. **CI strategy — defer.** No GitHub Actions in v1. The topout repo's
   public CI signal is "does `pnpm typecheck && pnpm build` pass locally";
   that's the interview signal. When `/build` lands, we can scaffold
   a single `.github/workflows/ci.yml` running typecheck + Convex
   dry-run + sidecar mypy. **Defer unless requested.**

5. **Seed account credentials.** I'm hard-coding `seed-demo-pw` as the
   single shared password for both seed accounts and surfacing it in the
   README. The spec lists this verbatim — confirm it's still acceptable
   given the repo is public (the demo identity is intentionally
   shared-credential).

6. **`isSeed` flag on `users`.** Not in the spec, but necessary for the
   prod-guarded wipe. Trivial schema addition; flagged for transparency.

7. **Top-grade-ever scope.** The KPI tile "Top grade ever sent" is
   window-independent per the spec. My queries scan all sessions for that
   user — fine at ~150 sessions/year. If the spec eventually relaxes this
   to "top grade in window", the query becomes window-bounded; trivial change.

8. **Convex Auth users-table fields.** I'm including the full set Convex
   Auth's `authTables.users` definition needs (`email`, `emailVerificationTime`,
   `phone`, `phoneVerificationTime`, `isAnonymous`), even though we'll
   only ever populate `email`. They're all `v.optional` so they don't
   leak into validation paths — but I want the dev to see they're there
   before they trip over them.

---

## 12. Things BackendDeveloper / FrontendDeveloper must NOT skip

A non-exhaustive list of footguns the specs imply but don't shout about.

- **Grade colors come from `@/lib/grade-colors.ts` only.** The Designer's
  invariant. Greppable in CI: search for `bg-sienna-` outside that file
  and `convex/`; flag as a hard fail.
- **`@/lib/ids.ts` is throwaway.** Delete it the moment
  `convex/_generated/dataModel.d.ts` exists. Import branded `Id<>` types
  from the generated file everywhere.
- **`@/lib/grades.ts` (frontend) and `convex/lib/enums.ts` (backend)
  must stay in lockstep.** If you edit one, edit the other, and update
  the BackendTester contract test that asserts the two arrays are equal.
- **No barrel `index.ts` files.** Imports go to exact paths.
- **`Dashboard` component takes `userId` — never reads a global user.**
  Same component for self and partner views.
- **`SummaryStatus` is a literal union, not booleans.** Don't introduce
  `isLoadingSummary` / `hasSummaryError`. Switch on `summaryStatus` directly.
- **`useQuery` everywhere reactive.** No `useEffect`-then-fetch on the
  dashboard or session list.
- **`Authorization: Bearer ${SIDECAR_SECRET}`** is on every sidecar
  request. The contract test must include a 401 case.
- **The sidecar has NO Convex client.** Data flows in one direction
  (Convex → sidecar) via the POST body.
- **Convex env vars are set via `npx convex env set`** — they don't
  live in `.env*` files because the Convex deployment is the source of
  truth for them. Document this on the README.
- **Tabular nums.** Every chart / KPI number uses `font-mono tabular-nums`
  so columns don't wobble. Already wired in `globals.css`.

---

## 13. Diagrams

See `apps/topout/diagrams/`:

| File | What |
|---|---|
| `convex-schema-erd.drawio` (+ .png) | All 6 tables + auth tables, with indexes labeled. |
| `service-topology.drawio` (+ .png) | Browser → Next.js (Vercel) → Convex Cloud → OpenAI + Python sidecar branch. Bearer-auth boundary marked; sidecar has no Convex client. |
| `weekly-report-graph.drawio` (+ .png) | The 3-node LangGraph with typed state arrows. |

PNGs render via `drawio -x -f png -s 2 -t -o foo.png foo.drawio` (per the
draw-io skill). The repo doesn't yet have a render hook; if BackendDeveloper
runs the pipeline, PNGs land next to the .drawio sources.
