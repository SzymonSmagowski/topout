# frontend/

Next.js 15 + Tailwind v4 + Convex client. The user-facing surface.

## Routes

Two route groups under `src/app/`:

| Group | Routes | Notes |
|---|---|---|
| `(auth)` | `/sign-in`, `/register` | Convex Auth Password pages |
| `(app)` | `/dashboard`, `/sessions`, `/sessions/new`, `/sessions/[sessionId]`, `/reports`, `/reports/[reportId]`, `/partners`, `/partners/[userId]` | Protected; `middleware.ts` redirects unauthenticated |

Plus `src/app/page.tsx` (redirects to `/dashboard`), `src/app/design-preview/page.tsx` (static design reference).

## Components

14 production components in `src/components/`:

- `AppShell` — nav + layout wrapper
- `Dashboard` — takes `userId: Id<'users'>`, same for self and partner
- `LogSessionForm` — writes via `createSession` mutation; all grade/outcome options from `@/lib/grades.ts`
- `SessionCard`, `SessionsList`, `SessionDetail` — session display hierarchy
- `AttemptRow` — single attempt in a session form or detail view
- `GradePill`, `OutcomePill` — colour-coded badges reading from `@/lib/grade-colors.ts`
- `GymCombobox` — autocomplete backed by `gyms.listByPrefix` query
- `SummaryBanner` — shows AI summary status (pending / done / error)
- `SidecarHealthBanner` — surfaces sidecar unreachable state
- `ConfirmModal`, `ThemeToggle`, `Logo`

## Testing

```bash
pnpm test           # Vitest unit + integration (uses src/__mocks__/)
pnpm test:e2e       # Playwright (requires ./dev.sh running first)
pnpm typecheck      # tsc --noEmit (requires pnpm exec convex dev to have run once)
```

`src/__mocks__/` — hand-rolled stubs for `convex-generated-api.ts` and `convex-generated-dataModel.ts`. Keeps unit tests independent of a live Convex deployment. When you add a new public function to the Convex schema, add a stub entry here too.

## Invariants

- Grade colours from `@/lib/grade-colors.ts` only — no inline `bg-sienna-*` elsewhere.
- `Dashboard` takes `userId: Id<'users'>` prop, never reads a global "current user".
- All reactive data via `useQuery`. No `useEffect`-then-fetch.
- Numeric values render in `font-mono tabular-nums`.
- No barrel files — import from exact paths.
- `SummaryStatus` is a string literal union, not a boolean trio.

## Bootstrap requirement

On a fresh clone, `convex/_generated/` doesn't exist yet. Before `pnpm typecheck` or `pnpm test` will pass:

```bash
cd apps/topout/frontend
pnpm exec convex dev   # prompts login + provisions dev deployment; Ctrl-C after first sync
```

## Local dev

```bash
pnpm install                    # from apps/topout/frontend
cp .env.local.example .env.local  # fill NEXT_PUBLIC_CONVEX_URL
# Day to day — from apps/topout/:
./dev.sh                        # next dev + convex dev + sidecar together
```
