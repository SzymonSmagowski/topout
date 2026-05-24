# topout

Bouldering training coach. Three services, one public repo.

## Subdirectories

- `frontend/` — Next.js 15 app. Routes, components, Convex client. See `frontend/CLAUDE.md` (Developer to add).
- `convex/` — Convex schema + queries + mutations + actions + scheduler. The data model SoT is `convex/schema.ts`. See `convex/CLAUDE.md` (Developer to add).
- `sidecar/` — Python FastAPI + LangGraph service for the weekly-report feature. See `sidecar/README.md`.
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
for the per-session AI summary. The session log form calls `createSession`
which writes session + attempts and schedules `internal.summarize.run`. The
dashboard / partner views read from `convex/dashboard.ts` queries that take
a `userId` and pass through `requireFollowing` for authorization.

**Python sidecar** is invoked sync-over-HTTP by exactly one Convex action
(`generateReport`). The sidecar holds no Convex client — data flows in via
the POST payload. The 3-node LangGraph topology runs `load_payload` →
`analyze_stats` (pandas) → `synthesize_narrative` (OpenAI). Bearer-auth via
shared `SIDECAR_SECRET`.

**LLM** isolated to `convex/llm/client.ts` and `sidecar/src/llm/client.py`.
Each exposes one function per call type. Vertex AI swap is a one-file change
on either side.

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

## Related

- App spec manifest: `docs/specs/topout/_manifest.md` (in the parent monorepo).
- Designer's UI/UX doc: `.claude/designs/topout-ui.md` (in the parent monorepo).
- Architect's technical doc: `apps/topout/docs/architecture.md` (this repo).
