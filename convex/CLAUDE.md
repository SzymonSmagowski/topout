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
| `summarize.ts` | BackendDev | Internal `run` action + public `retrySummary` mutation. |
| `reports.ts` | BackendDev | `generateReport` action (POSTs to sidecar), `listReports`, `getReport`. |
| `seed.ts` | BackendDev | Internal mutations + the `run` action called by `scripts/seed.ts`. |
| `llm/client.ts` | BackendDev | The OpenAI SDK lives here and nowhere else. |
| `llm/prompts/*.ts` | BackendDev | Const prompt strings. |
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
