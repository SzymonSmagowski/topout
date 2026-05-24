# TopOut — Frontend

Next.js 15 App Router client for the TopOut bouldering training coach. Talks to
Convex (auth + reactive DB + actions) and pings the Python sidecar's `/health`
on the reports page.

## Stack

- Next.js 15 App Router + TypeScript (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`)
- Tailwind CSS v4 (CSS-first config in `src/app/globals.css`)
- next-themes — light / dark, class-strategy
- Convex (`convex` + `@convex-dev/auth`) for auth + reactive queries
- Recharts (used directly with the design system's color tokens)
- react-markdown for the weekly-report narrative
- lucide-react for icons
- pnpm via Corepack — never npm

## First-run

```bash
pnpm install                              # from apps/topout/frontend/
cp .env.local.example .env.local          # fill NEXT_PUBLIC_CONVEX_URL
pnpm exec convex dev                      # first time only — creates _generated/ + Convex deployment
```

The Convex codegen step is **required before TypeScript compiles**:
`src/components/Dashboard.tsx`, `src/components/AppShell.tsx`, every page under
`(app)/`, etc all import `Id` / `Doc` / `api` from
`@convex/_generated/dataModel` and `@convex/_generated/api`. These files don't
exist in a fresh clone — `convex dev` generates them.

Then:

```bash
pnpm dev                                  # next dev on http://localhost:3000
# or from apps/topout/:
./dev.sh                                  # next dev + convex dev + sidecar together
```

## Routes

| Path | Auth | Notes |
|---|---|---|
| `/` | — | Server redirect: `/dashboard` if authed, `/sign-in` otherwise |
| `/sign-in` | guest | Email + password sign-in |
| `/register` | guest | Email + password + display name |
| `/dashboard` | required | Owner dashboard. Wraps `<Dashboard userId={viewer._id} />` |
| `/sessions` | required | Reverse-chronological own sessions list |
| `/sessions/new` | required | Log-session form |
| `/sessions/[id]` | required | Session detail + AI coach banner |
| `/sessions/[id]/edit` | required | Edit form, regenerates summary on save |
| `/partners` | required | Discover + follow / unfollow climbers |
| `/partners/[userId]` | required | Partner's dashboard via same `<Dashboard userId={…} />`. Gated by `follows.isFollowing` |
| `/partners/[userId]/sessions/[id]` | required | Read-only session detail (`isOwner=false`) |
| `/reports` | required | Weekly report list + "Generate this week" + sidecar health |
| `/reports/[id]` | required | Markdown narrative + stats card + regenerate |
| `/design-preview` | guest | Design preview — portfolio asset, static mock data |

Route guarding lives in `src/middleware.ts` via
`convexAuthNextjsMiddleware`. The unauthenticated `/` redirects to
`/sign-in`; authenticated visitors hitting `/sign-in` or `/register` are
redirected to `/dashboard`.

## Layout

```
src/
├── app/
│   ├── (app)/                            # authenticated routes — wrapped in <AppShell>
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── sessions/{page,new,[sessionId]/{page,edit/page}}.tsx
│   │   ├── partners/{page,[userId]/{page,sessions/[sessionId]/page}}.tsx
│   │   └── reports/{page,[reportId]/page}.tsx
│   ├── (auth)/                           # unauthenticated routes — bare layout
│   │   ├── layout.tsx
│   │   ├── sign-in/page.tsx
│   │   └── register/page.tsx
│   ├── design-preview/                   # portfolio-only preview page
│   ├── layout.tsx                        # next/font + Convex providers + ThemeProvider
│   ├── page.tsx                          # server redirect /
│   ├── providers.tsx                     # client-side Convex + theme providers
│   └── globals.css                       # Tailwind v4 @theme tokens
├── components/                           # production components used by app routes
│   ├── AppShell.tsx                      # top nav + user menu + signOut
│   ├── AttemptRow.tsx
│   ├── ConfirmModal.tsx
│   ├── Dashboard.tsx                     # the shared one — takes userId prop
│   ├── GradePill.tsx
│   ├── GymCombobox.tsx                   # gyms.listByPrefix + inline-create
│   ├── LogSessionForm.tsx                # create + edit, calls sessions.{create,update}
│   ├── Logo.tsx
│   ├── OutcomePill.tsx
│   ├── SessionCard.tsx
│   ├── SessionDetail.tsx                 # isOwner prop hides Edit / Delete
│   ├── SessionsList.tsx
│   ├── SidecarHealthBanner.tsx           # GET /health probe for /reports
│   ├── SummaryBanner.tsx                 # the discriminated-state coach blurb
│   └── ThemeToggle.tsx
├── lib/
│   ├── convex-client.ts                  # singleton ConvexReactClient
│   ├── grades.ts                         # V_GRADES + OUTCOMES (mirrors convex/lib/enums.ts)
│   ├── grade-colors.ts                   # single SoT for grade colors
│   ├── ids.ts                            # design-preview-only Id mirror (delete once everything uses @convex/_generated)
│   └── utils.ts                          # cn() — clsx + tailwind-merge
└── middleware.ts                         # route guarding
```

## Env vars

| Var | Where | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex deployment URL — `https://<slug>.convex.cloud` |
| `NEXT_PUBLIC_PYTHON_SIDECAR_URL` | `.env.local` | Used by `SidecarHealthBanner` on `/reports`. Default `http://localhost:8000` |

All other env vars (OpenAI key, sidecar secret, JWT keys, etc) live on the
Convex deployment and sidecar `.env` — **never committed**. The TopOut repo
is public.

## Invariants

- Grade colors come from `@/lib/grade-colors.ts` only — no inline `bg-sienna-*` outside that file.
- The `Dashboard` component takes `userId: Id<'users'>` and never reads a global user.
- `SummaryState` is a literal discriminated union, not boolean trios.
- Everywhere reactive uses `useQuery`. No `useEffect`-then-fetch.
- No barrel files. Import from exact paths.
- Numeric values render in `font-mono tabular-nums`.

## Seed credentials

Documented here for the demo identity only — these are deliberately public:

- `seed-alex@topout.local` / `seed-demo-pw` — Alex Climber (V3 → V5 arc)
- `seed-sam@topout.local` / `seed-demo-pw` — Sam Crusher (V4 → V6 arc)

Run `pnpm seed` from `apps/topout/` to populate.
