# topout

Bouldering training coach. Three services, one public repo.

## Subdirectories

- `frontend/` — Next.js 15 app. 11 routes, 14 components, Convex client. See `frontend/CLAUDE.md`.
- `convex/` — Convex schema + queries + mutations + actions + scheduler. The data model SoT is `convex/schema.ts`. See `convex/CLAUDE.md`.
- `sidecar/` — Python FastAPI + LangGraph service. Single LLM gateway for both AI features. See `sidecar/CLAUDE.md`.
- `scripts/` — Node scripts (currently just `seed.ts`).
- `diagrams/` — draw.io sources for architecture diagrams + their rendered PNGs.
- `docs/` — long-form documentation. `docs/architecture.md` is the implementation contract from the Architect agent.

## Dev

```bash
./apps/topout/dev.sh
```

Starts:
- frontend on port 3000 (magenta logs)
- Convex dev server (cyan logs) — keeps schema + codegen in sync
- Python sidecar on port 8000 (green logs)

Either service exiting tears all three down. Prereqs documented in `README.md`.

## Architecture at a glance

**Convex** owns auth, the database, every reactive query, and orchestration
for the per-session AI summary + weekly report. The session log form calls
`createSession` which writes session + attempts and schedules
`internal.summarizeActions.run`; the reports page calls
`reportsActions.generateReport`. Both actions are thin HTTP relays — they
hold no LLM SDK. Dashboard / partner views read from `convex/dashboard.ts`
queries that take a `userId` and pass through `requireFollowing` for
authorization.

**Python sidecar** is the single LLM gateway. Two LangGraph flows:
`/summarize-session` (3 nodes — load → format → synthesize) and
`/weekly-report` (3 nodes — load → analyze → synthesize). Bearer-auth via
shared `SIDECAR_SECRET`. The sidecar holds no Convex client — data flows in
via POST. Every graph node and every LLM call is captured by the Langfuse
`CallbackHandler`, attached via `config={"callbacks": [...]}` on the
underlying `ChatOpenAI` invocation.

**LLM** lives in `sidecar/src/llm/client.py` and nowhere else. One function
per call type (`summarize_session`, `synthesize_weekly_narrative`). Swap
the model in this one file — both Convex actions keep working unchanged.

## Important invariants

The handoff document at `docs/architecture.md` enumerates these. The
high-impact ones:

- **Grade colors come from `frontend/src/lib/grade-colors.ts` only.** No
  inline sienna utility classes outside that module.
- **`frontend/src/lib/grades.ts` (V_GRADES, OUTCOMES) and `convex/lib/enums.ts`
  must stay in lockstep.** A BackendTester contract test enforces this.
- **`Dashboard` takes a `userId` prop.** Same component for self and partner.
- **No barrel `index.ts` files.** Imports go to exact paths.
- **`@/lib/ids.ts` is throwaway.** Delete it once `convex/_generated/dataModel.d.ts`
  exists. All `Id<…>` types come from the generated file.
- **Secrets never live in committed files.** `.env.local.example` /
  `.env.example` exist; their non-`.example` siblings are gitignored.
- **No OpenAI SDK in Convex.** All LLM calls relay to the sidecar via HTTP.
  The `convex/llm/` directory does not exist; if you find yourself wanting
  to add an OpenAI import to a Convex action, add a sidecar route instead.
- **Langfuse traces every LLM call.** Both sidecar routes wrap the graph
  invocation in `propagate_attributes(user_id, session_id, tags)` so traces
  group correctly. Missing keys = graceful no-op (CI / local dev still run).

## Related

- App spec manifest: `docs/specs/topout/_manifest.md` (in the parent monorepo).
- Designer's UI/UX doc: `.claude/designs/topout-ui.md` (in the parent monorepo).
- Architect's technical doc: `apps/topout/docs/architecture.md` (this repo).
