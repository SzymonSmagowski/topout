# TopOut — Code Tour

A file-by-file walkthrough of the repository, organized by layer. The aim is to make every choice legible so you can read the code top-down: start at the entry point, follow the imports, and never wonder "wait, what owns this?"

If you only have 2 minutes, read the **Top-level map** below. Then dive into whatever layer interests you. Each layer ends with a **What I'd read first** pointer for the shortest path to understanding.

---

## Top-level map

```
topout/
├── frontend/    Next.js 15 App Router — the user-facing surface
├── convex/      Backend: schema, queries, mutations, actions, auth
├── sidecar/     Python FastAPI + LangGraph — the single LLM gateway
├── scripts/     Node scripts (just `seed.ts` for now)
├── diagrams/    Architecture diagrams (.drawio sources + rendered PNGs)
├── docs/        Long-form docs — architecture, this tour, deployment plan
├── dev.sh       Starts frontend + Convex dev + sidecar together
├── bootstrap.sh One-time setup for a fresh clone
└── *.config     Top-level workspace + lockfile
```

**Three rules that organize the whole repo:**

1. **One LLM gateway.** All OpenAI calls go through `sidecar/src/llm/client.py`. Convex never imports `openai`. Swap the model in one file, both AI features keep working.
2. **Reactive by default.** Every list view, every chart, every counter uses Convex's `useQuery`. There are no `useEffect`-then-fetch patterns and no client-side caches.
3. **Discriminated states.** Statuses are string-literal unions (`'pending' | 'ok' | 'err'`), not boolean trios. Errors are `ConvexError<{ kind: ErrorKind }>` with `ErrorKind` enumerated in `convex/lib/enums.ts`.

---

## Layer 1 — `frontend/`

Next.js 15 App Router app. Tailwind v4 for styling, Recharts for the dashboard charts, Radix primitives for headless UI bits.

### Routing — `frontend/src/app/`

Next's App Router. Files named `page.tsx` are routes; `layout.tsx` files wrap their subtree. Folders in parentheses (`(app)`, `(auth)`) are **route groups** — they organize files but don't appear in the URL.

```
src/app/
├── layout.tsx              Root layout. Mounts ThemeProvider + ConvexAuthNextjsServerProvider.
├── page.tsx                /  →  redirects to /dashboard (or /sign-in if unauthed)
├── providers.tsx           Client-side providers (ConvexClientProvider, theme).
├── globals.css             Tailwind v4 directives + CSS variables for the Chalk+Crag palette.
│
├── (auth)/                 ROUTE GROUP — unauthenticated routes.
│   ├── layout.tsx          Centered card layout, no nav.
│   ├── sign-in/page.tsx    Email + password sign-in.
│   └── register/page.tsx   Email + password register. Validates allowlist via ConvexError data.
│
├── (app)/                  ROUTE GROUP — authenticated routes. middleware.ts redirects unauthed.
│   ├── layout.tsx          Wraps in AppShell (nav + content area).
│   ├── dashboard/page.tsx                          /dashboard      — KPI tiles + 4 charts
│   ├── sessions/page.tsx                           /sessions       — list of own sessions
│   ├── sessions/new/page.tsx                       /sessions/new   — LogSessionForm
│   ├── sessions/[sessionId]/page.tsx               /sessions/:id   — SessionDetail
│   ├── sessions/[sessionId]/edit/page.tsx          /sessions/:id/edit
│   ├── reports/page.tsx                            /reports        — list + Generate button
│   ├── reports/[reportId]/page.tsx                 /reports/:id    — rendered markdown report
│   ├── partners/page.tsx                           /partners       — followed users
│   ├── partners/[userId]/page.tsx                  /partners/:id   — partner's dashboard
│   └── partners/[userId]/sessions/[sessionId]/page.tsx             — partner's session detail
│
└── design-preview/         Static design reference (Designer agent output, not part of the app).
    ├── page.tsx            Renders all UI components in isolation for visual review.
    ├── _components/        Mock variants of each real component, with hardcoded data.
    └── _data/mock.ts       The hardcoded data backing the preview.
```

**Notable invariants:**

- The same `Dashboard` component renders both your own dashboard and a partner's. It takes a `userId: Id<'users'>` prop. The reactive payoff (watch a partner's stats change in real time) is the whole point of the architecture.
- **No barrel `index.ts` files.** Every import is to an exact path. Saves bundler work and makes imports searchable.

### Components — `frontend/src/components/`

14 production components. One responsibility each, no compound files.

```
components/
├── AppShell.tsx            Nav bar + main content area. Wraps every (app) page.
├── Dashboard.tsx           4 KPI tiles + 4 charts. Takes userId — self or partner.
├── LogSessionForm.tsx      Date, gym, effort, attempts. Writes via createSession mutation.
├── AttemptRow.tsx          One attempt row inside the form / detail view.
├── SessionCard.tsx         One session preview (used in lists).
├── SessionsList.tsx        Owns the list state, renders SessionCards.
├── SessionDetail.tsx       Full session view: attempts + AI summary banner.
├── GradePill.tsx           V-scale grade chip. Reads color from grade-colors.ts.
├── OutcomePill.tsx         flash/send/repeat/project/fall chip. Same color system.
├── GymCombobox.tsx         Autocomplete backed by gyms.listByPrefix Convex query.
├── SummaryBanner.tsx       Renders the AI summary status (pending/done/error).
├── SidecarHealthBanner.tsx Surfaces sidecar_unreachable when AI features can't reach the sidecar.
├── ConfirmModal.tsx        Radix Dialog wrapper for destructive confirmations.
├── ThemeToggle.tsx         Light/dark toggle via next-themes.
└── Logo.tsx                The bouldering hex glyph.
```

**Invariants:**

- Grade colors come from `frontend/src/lib/grade-colors.ts` ONLY. No inline `bg-sienna-*` utility classes outside that module.
- Numeric values render in `font-mono tabular-nums` so columns line up.
- `SummaryStatus` is a string literal union (`'pending' | 'ok' | 'err'`), never three booleans.

### Helpers — `frontend/src/lib/`

```
lib/
├── grades.ts             V_GRADES + OUTCOMES arrays. Mirrors convex/lib/enums.ts —
│                         BackendTester contract test fails the build if they drift.
├── grade-colors.ts       Single source of truth for grade → CSS variable.
├── convex-client.ts      ConvexReactClient wrapped for the Next App Router.
├── use-authed-query.ts   useQuery wrapper that returns 'skip' when unauthenticated.
│                         Without this, sign-out causes a "not_authenticated" error
│                         flood as queries try to resubscribe.
├── ids.ts                Throwaway file — bridges the type gap before
│                         convex/_generated/dataModel.d.ts exists on a fresh clone.
│                         Delete it once you've run `pnpm exec convex dev` once.
└── utils.ts              cn() — clsx + tailwind-merge.
```

### Tests — `frontend/src/__tests__/` + `frontend/tests/e2e/`

```
src/__tests__/
├── setup.ts                  jest-dom matchers, jsdom shim.
├── pills.test.tsx            GradePill + OutcomePill — pure render tests.
├── AppShell.test.tsx         Nav state, sign-out menu.
├── LogSessionForm.test.tsx   Form validation, attempt add/remove.
└── SummaryBanner.test.tsx    Status state machine renders.

src/__mocks__/                 Hand-rolled stubs for Convex generated modules.
                               When you add a new public Convex function, add a stub here too.

tests/e2e/
└── auth-and-session.spec.ts  Playwright. Register → log a session → see it on /sessions.
                               Skipped in CI; runs locally against ./dev.sh.
```

### Config files

```
frontend/
├── package.json            deps + `pnpm.onlyBuiltDependencies` allowlist for esbuild/sharp.
├── pnpm-workspace.yaml     `allowBuilds: { esbuild, sharp, unrs-resolver: true }` —
│                           the workspace-level equivalent of onlyBuiltDependencies.
│                           Both are needed because Vercel reads one, the local CLI reads the other.
├── pnpm-lock.yaml          Committed.
├── tsconfig.json           strict + noUncheckedIndexedAccess + paths for @/ and @convex/.
├── next.config.ts          ignoreBuildErrors + ignoreDuringBuilds — see deployment-plan.md
│                           Phase 4 lessons for why.
├── postcss.config.mjs      Tailwind v4 + autoprefixer.
├── playwright.config.ts    chromium project only; baseURL = http://localhost:3000.
├── vitest.config.ts        jsdom env, alias paths matching tsconfig.
├── vercel.json             Build wrapper: symlinks node_modules into ../convex, then runs
│                           `pnpm exec convex deploy --cmd 'pnpm run build'`.
├── convex.json             {"functions": "../convex/"} — tells Convex CLI where the
│                           sibling backend lives.
├── .env.local              gitignored — NEXT_PUBLIC_CONVEX_URL.
└── .env.local.example      Template.
```

**What I'd read first:** `src/app/(app)/dashboard/page.tsx`. It shows `useAuthedQuery` usage, the `Dashboard` component prop shape, and how reactive data flows in.

---

## Layer 2 — `convex/`

Convex backend. Schema, queries, mutations, actions, scheduler. Convex Auth (Password provider).

### Top-level files

```
convex/
├── schema.ts              The 6-table data model + authTables. Source of truth.
├── auth.ts                Convex Auth Password provider. profile() captures displayName
│                          and runs the email allowlist check on sign-up.
├── auth.config.ts         Convex Auth provider discovery.
├── http.ts                Convex HTTP routes — wires auth.addHttpRoutes(http).
├── users.ts               viewer (soft auth, null when unauthed) + getPublic.
├── gyms.ts                listByPrefix (autocomplete), ensureByName (find-or-create).
├── sessions.ts            createSession, updateSession, deleteSession, listOwn,
│                          listForUser, getById. Schedules summarize action on create.
├── attempts.ts            Internal helpers (bySessionInternal) for the summarize action.
├── follows.ts             follow, unfollow, listPartners, listFollowing, listFollowers.
├── dashboard.ts           5 reactive queries: kpiStats, sendPyramid, weeklyVolume,
│                          gradeAttemptDist, sendRateTrend. All take userId.
├── summarize.ts           Public retrySummary mutation (default V8 runtime).
├── summarizeActions.ts    'use node'; internal `run` action — HTTP relay to sidecar's
│                          /summarize-session. No OpenAI SDK here.
├── reports.ts             listReports, getReport, internal mutations (V8 runtime).
├── reportsActions.ts      'use node'; generateReport action — HTTP relay to sidecar's
│                          /weekly-report.
├── seed.ts                Internal mutations + queries for the seed flow (V8 runtime).
├── seedActions.ts         'use node'; top-level seed `run` action with the deterministic
│                          PRNG and 84-day arc generator. Called by scripts/seed.ts.
├── tsconfig.json          Convex-managed.
└── CLAUDE.md              Module map + conventions. Read this for backend dev.
```

**Why are `summarize.ts` and `summarizeActions.ts` split?** Convex's `"use node";` directive forces a file into the Node runtime, but that runtime can't host queries or mutations. Anything that calls `fetch` against an external HTTP service must live in a `"use node";` file containing ONLY actions. The split is mechanical — the `Actions.ts` file is the Node-runtime sibling of the same logical module.

**Why are `seed.ts` and `seedActions.ts` split?** Same reason — the seed action calls `createAccount` from `@convex-dev/auth/server`, which requires ActionCtx (it internally uses `ctx.runMutation`). The mutations in `seed.ts` are the V8-runtime side (DB writes, idempotency check).

### Helpers — `convex/lib/`

```
lib/
├── auth.ts        requireUser, requireOwner, requireFollowing.
│                  EVERY public mutation/query wraps in one of these.
├── enums.ts       V_GRADES, OUTCOMES, vGrade, vOutcome, SummaryStatus, ReportStatus,
│                  TimeWindow, ErrorKind. The single source of truth for both
│                  runtime validators (v.union(...)) and TS types.
├── errors.ts      typedError(kind, message?) — single throw helper. Index-signature
│                  on TypedErrorPayload to satisfy ConvexError<Value> constraint.
└── time.ts        windowStart(window, now), weekStartFor(date) — pure functions,
                   no Date math elsewhere.
```

### Seed support — `convex/seed/`

```
seed/
└── notes.ts       ATTEMPT_NOTE_POOL + SUMMARY_TEMPLATE_POOL — string arrays the
                   PRNG picks from when generating seed data. Kept separate so the
                   action file doesn't carry inert content.
```

### Tests — `convex/tests/`

```
tests/
├── enums_mirror.test.ts   Asserts convex/lib/enums.ts and frontend/src/lib/grades.ts
│                          have identical V_GRADES + OUTCOMES arrays. Drift = build fail.
└── sidecar_contract.test.ts  Asserts the request/response shape that summarizeActions.ts
                              and reportsActions.ts POST matches what the sidecar's
                              schemas.py expects.
```

### Generated — `convex/_generated/`

```
_generated/
├── api.d.ts         api.* and internal.* typed module trees.
├── api.js           Runtime barrel (re-exports for client usage).
├── dataModel.d.ts   Id<'table'> branded types + Doc<'table'> document types.
├── server.d.ts      Typed ctx + query/mutation/action factories.
└── server.js        Runtime stubs.
```

Gitignored. Created by `pnpm exec convex dev` and `convex deploy`. Every Convex file imports from here for types.

**Invariants:**

- Every public function declares `args` + `returns` validators. TS types derive via `Infer<typeof argsValidator>`; no hand-rolled mirrors.
- `ConvexError({ kind, message? })` with `kind` from `lib/enums.ts`. The frontend switches on `error.data.kind`.
- Scheduler over polling. `createSession` schedules `internal.summarizeActions.run`; clients never invoke the action directly.

**What I'd read first:** `schema.ts` (the data model) then `dashboard.ts` (every chart query in one place — the reactive payoff).

---

## Layer 3 — `sidecar/`

Python FastAPI + LangGraph service. The **single LLM gateway** — every OpenAI call goes through here.

### Entry point + top-level

```
sidecar/
├── pyproject.toml      Poetry deps + mypy/ruff/black configs.
├── poetry.lock         Committed.
├── run.sh              poetry run uvicorn src.main:app --reload --port 8000
├── .env                gitignored. SIDECAR_SECRET + OPENAI_API_KEY at minimum.
├── .env.example        Template.
└── CLAUDE.md           Module map + Langfuse wiring details.
```

### Code — `sidecar/src/`

```
src/
├── main.py             FastAPI app factory. Mounts routes + middleware + the
│                       Langfuse init lifecycle hook.
├── auth.py             Bearer-token middleware. Validates Authorization header
│                       against SIDECAR_SECRET env var. Convex actions set this header.
├── schemas.py          Pydantic v2 request/response models. The contract test in
│                       convex/tests/sidecar_contract.test.ts pins these shapes.
│
├── core/               Cross-cutting infrastructure.
│   ├── settings.py     Pydantic Settings — env var loading + defaults.
│   └── logger.py       structlog config — JSON logs in prod, pretty in dev.
│
├── routes/             FastAPI route handlers. One file per endpoint.
│   ├── health.py                  GET /health — liveness probe (no auth).
│   ├── summarize_session.py       POST /summarize-session — invokes summarize graph.
│   └── weekly_report.py           POST /weekly-report — invokes weekly graph.
│
├── graph/              LangGraph state graphs. Two routes, two graphs.
│   ├── state.py                   TypedDict state types for both graphs.
│   ├── nodes.py                   Shared node helpers.
│   ├── summarize_session.py       3-node graph: load_payload → format_context →
│   │                              synthesize_summary.
│   └── weekly_report.py           3-node graph: load_payload → analyze_stats
│                                  (pandas time-series) → synthesize_narrative.
│
├── llm/                LLM gateway — the file you swap to change models.
│   ├── client.py                  One function per call type:
│   │                                summarize_session(...)
│   │                                synthesize_weekly_narrative(...)
│   │                              Both wrap ChatOpenAI with the configured model.
│   └── prompts/
│       ├── summarize_session.py   Prompt string for the per-session coaching blurb.
│       └── weekly_report.py       Prompt string for the weekly narrative.
│
└── observability/
    └── langfuse.py     Two singletons: get_langfuse_client() + get_callback_handler().
                         Both return None when LANGFUSE_*_KEY env vars are unset —
                         CI runs without traces, no errors.
```

### Tests — `sidecar/tests/`

```
tests/
├── conftest.py                          Patches ChatOpenAI + Langfuse so tests
│                                        don't need real API keys.
├── test_health.py                       GET /health → 200.
├── test_llm_client.py                   client.py functions return expected shapes
│                                        when ChatOpenAI is stubbed.
├── test_observability.py                Langfuse singletons no-op cleanly with no env.
├── test_summarize_session_route.py      End-to-end route test with stubbed LLM.
└── test_weekly_report_route.py          Same for the weekly route.
```

5 test files, all use the in-process FastAPI test client. <2s total.

**Invariants:**

- Every LLM call captured by Langfuse `CallbackHandler` (when keys present), attached via `config={"callbacks": [...]}` on the underlying `ChatOpenAI.invoke()`.
- Route handlers wrap graph invocation in `propagate_attributes(user_id, session_id, tags)` so traces group correctly per-user.
- The sidecar holds no Convex client. Data flows in via POST body; the sidecar never reads from Convex.

**What I'd read first:** `src/main.py` (FastAPI wiring) → `src/routes/summarize_session.py` (the simpler graph route) → `src/graph/summarize_session.py` (the graph definition).

---

## Layer 4 — glue & operations

### Scripts — `scripts/`

```
scripts/
├── seed.ts             Thin invoker for internal.seedActions.run. Two prod guards:
│                       client-side ALLOWED_SEED_DEPLOYMENTS check + Convex action's
│                       assertNonProd.
├── README.md           Seed usage docs.
└── CLAUDE.md           Same for AI context.
```

### Operations

```
dev.sh                  Starts frontend (3000) + convex dev + sidecar (8000)
                        together. Either service exiting tears all three down.
bootstrap.sh            One-time setup: pnpm install, symlink node_modules into
                        convex/, generate JWT keys, mirror OPENAI_API_KEY from
                        sibling app, generate SIDECAR_SECRET, poetry install.
                        Run once after `git clone`.
```

### Diagrams — `diagrams/`

```
diagrams/
├── convex-schema-erd.drawio       6-table ERD with relationships + indexes.
├── service-topology.drawio        Browser → Vercel → Convex → Sidecar → OpenAI/Langfuse.
├── llm-flows.drawio               Both LangGraph topologies side by side.
└── CLAUDE.md                       Diagram conventions.
```

All authored in draw.io desktop. PNG renders live next to each .drawio source (not all renders are committed — regenerate before sharing).

### Docs — `docs/`

```
docs/
├── architecture.md         The Architect agent's lock — API contract + design rationale.
│                            Reading this gives you the WHY behind the structure.
├── code-tour.md             This file.
└── deployment-plan.md       Five-phase shipping plan + per-phase lessons learned.
                              Frozen in time at each phase boundary so a fresh
                              session can resume.
```

---

## Layer 5 — workspace & lockfiles (the top of the tree)

```
topout/
├── package.json            Workspace root. Just devDeps for the seed script + lint scripts.
├── pnpm-workspace.yaml     packages: [frontend]. Plus allowBuilds mirroring frontend's
│                           workspace yaml so `pnpm install` from root works.
├── pnpm-lock.yaml          Committed.
├── .gitignore              env/secret/scratch/build-output patterns.
├── .env                    Local-only Convex deployment vars (gitignored).
├── .env.example            Template.
├── .sidecar-secret.scratch Phase-2 → Phase-3 handoff (gitignored via *.scratch).
└── CLAUDE.md               AI-context entry point. Sibling to this file but shorter.
```

**Why two pnpm-workspace.yaml files?** The frontend has its own (`frontend/pnpm-workspace.yaml`) because Vercel only sees the `frontend/` directory as its build root and needs the `allowBuilds` config there. The topout-level one (`pnpm-workspace.yaml`) is for monorepo-style local dev. They must stay consistent; the comments in each remind future editors.

---

## Reading order recommendations

**If you've never used Convex:** Start with `schema.ts`, then `dashboard.ts`, then any single route in `frontend/src/app/(app)/`. The "live data prop drilled through `useAuthedQuery`" pattern is the whole architecture in three files.

**If you want to see the LLM plumbing:** Start at `frontend/src/components/SummaryBanner.tsx` (the UI), follow to `convex/summarize.ts` + `convex/summarizeActions.ts` (the HTTP relay), then to `sidecar/src/routes/summarize_session.py` (the receiver), and finally `sidecar/src/llm/client.py` (where the model is actually called).

**If you want to ship a new app like this:** Read `docs/architecture.md` for the contract, `docs/deployment-plan.md` for the shipping playbook, and the `frontend/CLAUDE.md` + `convex/CLAUDE.md` + `sidecar/CLAUDE.md` triple for layer-specific conventions.

**If you want to debug a failing AI call:** Open Langfuse, find the trace by user_id, drill into the graph node where it failed. The trace will tell you which prompt + which model invocation; both are in `sidecar/src/llm/`.

---

## Cross-references

| Want to know... | Read |
|---|---|
| Why these tables, what each field means | [`docs/architecture.md`](./architecture.md) — Architect's contract |
| Convex module conventions, authorization helpers | [`convex/CLAUDE.md`](../convex/CLAUDE.md) |
| Frontend route map + component invariants | [`frontend/CLAUDE.md`](../frontend/CLAUDE.md) |
| Sidecar routes + Langfuse wiring | [`sidecar/CLAUDE.md`](../sidecar/CLAUDE.md) |
| How this got deployed (five phases) | [`docs/deployment-plan.md`](./deployment-plan.md) |
| Visual: data model, service flow, LangGraph topology | [`diagrams/`](../diagrams/) |
