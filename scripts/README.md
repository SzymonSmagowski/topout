# scripts/

Node scripts that aren't Convex functions. Today: just `seed.ts`.

## `seed.ts` (created by BackendDeveloper)

`pnpm seed` from `apps/topout/`. Uses `ConvexHttpClient` to call
`internal.seed.run` on the configured Convex deployment.

Env vars (in gitignored `apps/topout/.env`):

```bash
CONVEX_URL=https://your-dev-deployment.convex.cloud
CONVEX_DEPLOY_KEY=...                  # for setAdminAuth
SEED_USER_PASSWORD=seed-demo-pw        # documented in README
RNG_SEED=42                             # default
```

The script's job is thin: load env, refuse on production-looking
`CONVEX_DEPLOYMENT`, then `await client.action(internal.seed.run, args)`.
The actual seed logic lives in `convex/seed.ts` so it runs inside Convex
with full validator coverage. See the spec in
`docs/specs/topout/seed-data.md` for the data shape and the production
guard logic.

CLI flags (per the spec, mostly Should-priority):
- `--seed <n>`     — override the PRNG seed (default 42)
- `--users <list>` — restrict to a subset (`--users alex`)
- `--no-follows`   — skip mutual-follow setup
- `--llm-notes`    — opt in to OpenAI-generated attempt notes (Could)
