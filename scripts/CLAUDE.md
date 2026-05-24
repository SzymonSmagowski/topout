# scripts/

One file: `seed.ts`.

## seed.ts

Thin Node invoker that calls `internal.seedActions.run` on the Convex
deployment via the admin HTTP client. All data-generation logic lives
in `convex/seedActions.ts` (the Convex action) and `convex/seed.ts`
(internal mutations).

**Production refusal — two layers:**
1. Client-side: checks `CONVEX_DEPLOYMENT` against a regex (`^dev:`) or the
   `ALLOWED_SEED_DEPLOYMENTS` allowlist before even making the HTTP call.
2. Server-side: `convex/seed.ts::assertNonProd` (the authoritative guard)
   re-checks inside the Convex action.

**Determinism:** the PRNG seed defaults to `42`, overridable with `--seed <n>`.
This makes the generated sessions reproducible across fresh clones.

**Invoke:**

```bash
# from apps/topout/ root
pnpm seed                      # creates Alex + Sam, 84 days of data, mutual follows
pnpm seed -- --users alex      # just Alex
pnpm seed -- --seed 99         # different PRNG seed
pnpm seed -- --no-follows      # skip the mutual follow setup
```

Required env vars (`apps/topout/.env`, gitignored):
- `CONVEX_URL` — `https://<deployment>.convex.cloud`
- `CONVEX_DEPLOY_KEY` — admin key from Convex dashboard

Requires `convex/_generated/api` to exist (run `pnpm exec convex dev` once first).
