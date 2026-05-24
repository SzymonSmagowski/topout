# convex/

Convex backend for TopOut. Schema, queries, mutations, actions, scheduler,
and Convex Auth.

## Module map

| File | Owner | Purpose |
|---|---|---|
| `schema.ts` | Architect | The 6-table data model + `authTables`. **Do not refactor without coordinating with the Designer's grade-colors / grade-enums files.** |
| `auth.ts` | BackendDev | Convex Auth Password provider + the `profile()` that captures `displayName` at sign-up. |
| `auth.config.ts` | BackendDev | Convex Auth provider discovery config. |
| `http.ts` | BackendDev | Convex Auth HTTP route wiring (`auth.addHttpRoutes(http)`). |
| `lib/enums.ts` | Architect | `V_GRADES`, `OUTCOMES`, `vGrade`, `vOutcome`, `ErrorKind` — the validator + TS type source of truth. |
| `lib/auth.ts` | BackendDev | `requireUser`, `requireOwner`, `requireFollowing`. |
| `lib/time.ts` | BackendDev | `windowStart(window, now)`, `weekStartFor(date)`. |
| `lib/errors.ts` | BackendDev | `typedError({ kind })` sugar. |
| `gyms.ts` | BackendDev | `listByPrefix`, `ensureByName`. |
| `sessions.ts` | BackendDev | `createSession`, `updateSession`, `deleteSession`, `listOwn`, `listForUser`, `getById`. |
| `attempts.ts` | BackendDev | Internal helpers for the summarize action (`bySessionInternal`). |
| `dashboard.ts` | BackendDev | All 5 reactive queries powering the dashboard (`kpiStats`, `sendPyramid`, `weeklyVolume`, `gradeAttemptDist`, `sendRateTrend`). |
| `follows.ts` | BackendDev | `follow`, `unfollow`, `listPartners`, `listFollowing`, `listFollowers`. |
| `summarize.ts` | BackendDev | Public `retrySummary` mutation (default V8 runtime). |
| `summarizeActions.ts` | BackendDev | Internal `run` action (`'use node';` — thin HTTP relay to the sidecar's `/summarize-session`). |
| `reports.ts` | BackendDev | `listReports`, `getReport`, internal mutations / queries used by the action (default V8 runtime). |
| `reportsActions.ts` | BackendDev | `generateReport` action (`'use node';` — HTTP relay to the sidecar's `/weekly-report`). |
| `users.ts` | BackendDev | `viewer` (soft auth — returns null when unauthenticated), `getPublic` (display-only public profile). |
| `seed.ts` | BackendDev | Internal mutations (default V8 runtime — `wipeSeedUsers`, `ensureGyms`, `createSeedUserMutation` via Convex Auth's `createAccount`, `insertFollow`, `assertNonProd`). |
| `seedActions.ts` | BackendDev | Top-level `run` action (`'use node';`) called by `scripts/seed.ts`. Contains the deterministic PRNG and the 84-day arc generator. |
| `_generated/` | Convex | Generated. Gitignored. |

## Conventions

- Every public function declares `args` + `returns` validators. TS types
  derive via `Infer<typeof argsValidator>`; no hand-rolled mirrors.
- Every `mutation` / `action` is wrapped by `requireUser` / `requireOwner`
  / `requireFollowing` from `lib/auth.ts`. Never read `ctx.auth` directly.
- `ConvexError({ kind, message? })` with `kind` from `lib/enums.ts`. UI
  switches on `error.data.kind`.
- Discriminated `summaryStatus` / `status` fields, never boolean trios.
- Scheduler over polling. `createSession` and `updateSession` schedule
  `internal.summarize.run`; clients never invoke the action directly.
- `npx convex env set OPENAI_API_KEY …` — env vars live in the deployment,
  not in a `.env` file.

## Authorization helpers

```ts
await requireUser(ctx);                        // every authenticated function
await requireOwner(ctx, sessionId);            // every owner-only mutation
await requireFollowing(ctx, targetUserId);     // every partner-view query
```

If you write a function exposing another user's data and forget
`requireFollowing`, the BackendTester contract test will fail the build.

## Generating IDs / types

After editing `schema.ts`, run `pnpm convex:dev` (or keep `./dev.sh` running).
Convex regenerates `_generated/dataModel.d.ts` which exports the branded
`Id<'table'>` types and the `Doc<'table'>` document types. Import them
everywhere — never use bare `string` for an entity ID.

## First-boot bootstrap (one-time)

The `_generated/` directory is gitignored. On a fresh clone:

```bash
cd apps/topout/frontend
pnpm install
pnpm exec convex dev          # interactive — login + provision deployment
# Once the first sync prints "Convex functions ready", Ctrl-C is fine.
```

This step populates `apps/topout/convex/_generated/` with the typed `api`,
`internal`, and `DataModel` modules. **`pnpm typecheck` will fail until this
step runs** because every file under `convex/` imports from
`./_generated/...`. Same applies to `scripts/seed.ts`.

## Why are `summarize.ts` + `summarizeActions.ts` split (and likewise for `reports.ts` / `seed.ts`)?

Convex's `"use node";` directive forces a file into the Node runtime, but
that runtime cannot host queries or mutations. Anything that calls `fetch`
against an external HTTP service (the sidecar) or uses other Node-only
APIs must live in a `"use node";` file containing ONLY actions. The split
is mechanical, not semantic — the `Actions.ts` variant is the Node-runtime
sibling of the regular file.

After the LLM-gateway consolidation neither `summarizeActions.ts` nor
`reportsActions.ts` imports the OpenAI SDK — both are pure HTTP relays to
the sidecar. The `'use node';` directive is still required because Convex
treats outbound `fetch` calls as Node-only, but the surface area inside
each Node module is now tiny.

## Directive placement

`'use node';` MUST be the literal first line of the file (after no
whitespace, no comments, no docblock). Convex's module scanner looks for
the directive in token position 1; anything above it — even a JSDoc
docblock — disables Node-runtime hoisting and the action silently runs in
the V8 runtime where `fetch` against external hosts is blocked. The
docblock goes immediately AFTER the directive.
