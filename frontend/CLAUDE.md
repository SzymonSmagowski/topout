# frontend/

Next.js 15 + Tailwind v4 + Convex client. The user-facing surface.

## What exists already (Designer scaffold)

- `src/app/design-preview/page.tsx` — full design preview at `/design-preview`.
- `src/app/page.tsx` — root redirect to `/design-preview` (replace with auth-aware redirect once Convex Auth lands).
- `src/app/layout.tsx` — Inter Tight + JetBrains Mono fonts wired via `next/font/google`.
- `src/app/providers.tsx` — next-themes provider (class strategy).
- `src/app/globals.css` — Tailwind v4 `@theme` tokens + `@layer components` form primitives.
- `src/lib/grades.ts` — `V_GRADES`, `OUTCOMES`, derived types. **Must stay in lockstep with `convex/lib/enums.ts`.**
- `src/lib/grade-colors.ts` — the sienna ramp. Every grade-coloured pixel reads from here.
- `src/lib/ids.ts` — temporary branded `Id<T>` mirror. **Delete once `convex/_generated/dataModel.d.ts` exists.**
- `src/lib/utils.ts` — `cn()` helper (tailwind-merge + clsx).
- `src/app/design-preview/_components/*` — preview-only components. Promote individual ones to `src/components/` as production code claims them.

## What FrontendDeveloper adds

See `apps/topout/docs/architecture.md` §8 for the full route map. Highlights:

1. Install Convex deps: `pnpm add convex @convex-dev/auth @auth/core`.
2. Add `<ConvexAuthNextjsServerProvider>` in `layout.tsx` and `<ConvexProviderWithAuth>` in `providers.tsx`.
3. Add `src/middleware.ts` with `convexAuthNextjsMiddleware` route guarding.
4. Replace `src/lib/ids.ts` imports with `import type { Id } from '@convex/_generated/dataModel'`.
5. Build the 11 routes listed in the architecture doc, reusing existing design components.

## Invariants

- Grade colours come from `@/lib/grade-colors.ts` only — no inline `bg-sienna-*` outside that file.
- The `Dashboard` component takes `userId: Id<'users'>` and never reads a global "current user".
- `SummaryStatus` is a literal union, not booleans.
- Everywhere reactive uses `useQuery`. No `useEffect`-then-fetch.
- No barrel files. Import from exact paths.
- Numeric values render in `font-mono tabular-nums`.

## Local dev

```bash
pnpm install                                 # from apps/topout/frontend
cp .env.local.example .env.local             # fill NEXT_PUBLIC_CONVEX_URL
pnpm dev                                     # next dev only
# or, from apps/topout/:
../dev.sh                                    # next dev + convex dev + sidecar together
```
