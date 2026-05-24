# TopOut — Frontend (design-preview scaffold)

This is the Next.js 15 scaffold that the `/build topout` pipeline will fill in.
For now it ships a single route — `/design-preview` — that renders every
feature in the spec with static mock data so the visual language ("Chalk + Crag")
can be reviewed end-to-end before Convex is wired.

## Stack

- Next.js 15 App Router + TypeScript (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`)
- Tailwind CSS v4 (CSS-first config in `src/app/globals.css`)
- next-themes for light / dark toggle (warm light + warm dark, no cold corporate gradients)
- next/font/google for **Inter Tight** (UI) + **JetBrains Mono** (numbers, V-grades)
- Recharts (used directly with the design system's color tokens)
- lucide-react for icons
- pnpm via Corepack — never npm

## Run

```bash
pnpm install   # first time only
pnpm dev       # http://localhost:3000  → redirects to /design-preview
```

The dev server hot-reloads on file changes.

## Layout

```
src/
├── app/
│   ├── globals.css                 # Tailwind v4 @theme tokens + Chalk + Crag palette
│   ├── layout.tsx                  # next/font + ThemeProvider
│   ├── page.tsx                    # redirect → /design-preview
│   ├── providers.tsx               # ThemeProvider (class strategy)
│   └── design-preview/
│       ├── page.tsx                # one route renders all 7 feature surfaces
│       ├── _components/            # shell, sections, chart, banner
│       └── _data/mock.ts           # static, deterministic mock data
└── lib/
    ├── grades.ts                   # V_GRADES + OUTCOMES (string-literal unions, no enum)
    ├── grade-colors.ts             # single-source-of-truth grade color scale
    ├── ids.ts                      # branded Id<'tableName'> mirror of Convex's type
    └── utils.ts                    # cn() — clsx + tailwind-merge
```

## Env vars (FUTURE — none required for the preview)

The preview uses zero env vars. Once `/build` wires Convex + the Python sidecar:

| Var | Where | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex deployment URL |
| `CONVEX_DEPLOYMENT` | Convex dashboard | dev/prod split |
| `OPENAI_API_KEY` | Convex env + sidecar `.env` | gpt-5.4-nano |
| `OPENAI_MODEL` | Convex env + sidecar `.env` | defaults to `gpt-5.4-nano` |
| `SIDECAR_URL` | Convex env | `http://localhost:8002` in dev |
| `SIDECAR_SECRET` | Convex env + sidecar `.env` | bearer token |

All of these live in **gitignored** `.env.local` / `.env` files. The topout
GitHub repo is public — never commit secrets.

## Seed credentials (after `/build`)

Documented here for the demo identity only — these are deliberately public:

- `seed-alex@topout.local` / `seed-demo-pw` — Alex Climber (V3 → V5 arc)
- `seed-sam@topout.local` / `seed-demo-pw` — Sam Crusher (V4 → V6 arc)
