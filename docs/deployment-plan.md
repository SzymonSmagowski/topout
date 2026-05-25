# TopOut deployment plan

**Status:** locked, awaiting interactive logins. Drafted 2026-05-25.

Three services, five phases, ~60 min wall-clock. Pause after each phase per the standing pause-after-each-agent rule.

## Locked decisions

| Item | Value | Notes |
|---|---|---|
| Allowlist | `smagowski.szymon@gmail.com` only | Seed emails auto-exempt via `@topout.local` system-domain check in `convex/auth.ts` — no need to list them |
| Frontend domain | `topout.smagowskiai.dev` | Cloudflare CNAME → `cname.vercel-dns.com`, DNS-only |
| Sidecar domain | `topout-sidecar.smagowskiai.dev` | Caddy on apartment VM @ 34.53.156.72, DNS-only Cloudflare A record |
| OpenAI key | Reuse `apps/portfolio-ai-lab/backend/.env` value | Rotate later if needed |
| Execution | Direct (Claude drives); pause after each phase | CloudEngineer agent only for Phase 3 |

## Architecture (with concrete URLs)

```
  Browser
    │
    ▼
  topout.smagowskiai.dev  ← Cloudflare CNAME → cname.vercel-dns.com
    │
    ▼  (Vercel edge)
  Next.js frontend (apps/topout/frontend)
    │
    ▼  reactive WSS + JWT bearer
  <prod-slug>.convex.cloud         ← npx convex deploy
    │
    ▼  HTTPS + SIDECAR_SECRET bearer
  topout-sidecar.smagowskiai.dev   ← Caddy on apartment VM
    │
    ├─→ OpenAI (gpt-5.4-nano)
    └─→ http://langfuse-web:3000   ← in-VM, per-app org
```

## Execution order

### Phase 1 — interactive logins (user, ~5 min) ← start here

```bash
cd apps/topout/frontend
npx convex login     # browser, Gmail/GitHub auth
vercel login         # email + magic link
```

User signals "ready" when both done.

### Phase 2 — Convex prod deploy + env (Claude, ~10 min)

```bash
cd apps/topout/frontend

# 1. Deploy schema + functions to a new prod deployment
npx convex deploy

# 2. Mint fresh JWT keys for prod (distinct from dev anonymous keys)
npx @convex-dev/auth --prod

# 3. Set deployment env vars
npx convex env set --prod ALLOWED_REGISTRATION_EMAILS "smagowski.szymon@gmail.com"
npx convex env set --prod OPENAI_API_KEY "$(grep ^OPENAI_API_KEY ../../portfolio-ai-lab/backend/.env | cut -d= -f2-)"
npx convex env set --prod OPENAI_MODEL "gpt-5.4-nano"
npx convex env set --prod SIDECAR_SECRET "$(openssl rand -hex 32)"
npx convex env set --prod PYTHON_SIDECAR_URL "https://topout-sidecar.smagowskiai.dev"
npx convex env set --prod SITE_URL "https://topout.smagowskiai.dev"
```

**Save** the SIDECAR_SECRET value locally (Claude memory or scratch file) — feed it to CloudEngineer in Phase 3 so the sidecar uses the matching value.

**Smoke test:** Convex dashboard shows all 22 functions deployed, 21 indexes built.

→ PAUSE for verdict.

### Phase 3 — Sidecar on apartment VM (CloudEngineer agent, ~20 min)

Dispatch CloudEngineer with brief:

- Confirm `ai-lab-topout` GCP project exists (pre-created manually per `feedback_cloud_work_consult_cloudengineer.md`). If not, prompt user.
- Add `topout` entry to `terraform/prod.auto.tfvars:app_projects` map. `oauth_clients` stays empty `{}` (no OAuth, email+password only).
- Build sidecar Docker image from `apps/topout/sidecar/Dockerfile` (the existing file — confirm it exists; if not, generate per the portfolio-ai-lab pattern).
- Push to `europe-central2-docker.pkg.dev/ai-lab-topout/sidecar/topout-sidecar:<sha>`.
- Provision Langfuse org+project via `provision-langfuse-org.sh topout-sidecar` per `project_langfuse_per_app_isolation.md`. Keys auto-written to Secret Manager.
- Wire container env vars from Secret Manager:
  - `OPENAI_API_KEY` (reuse cross-app secret or per-app — CloudEngineer decides per convention)
  - `SIDECAR_SECRET` (must match Phase 2's value — Claude passes it in the brief)
  - `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` (from per-app provisioning)
  - `LANGFUSE_HOST=http://langfuse-web:3000`
  - `LANGFUSE_ENVIRONMENT=production`
  - `OPENAI_MODEL=gpt-5.4-nano`
- Add Caddy reverse-proxy block: `topout-sidecar.smagowskiai.dev` → container port 8000.
- Add Cloudflare DNS A record `topout-sidecar.smagowskiai.dev → 34.53.156.72` (DNS-only, **not** proxied — Caddy issues its own LE cert).
- `terraform apply`.

**Smoke test:** `curl https://topout-sidecar.smagowskiai.dev/health` → `{"status":"ok","model":"gpt-5.4-nano"}`.

→ PAUSE for verdict.

### Phase 4 — Vercel deploy (Claude, ~10 min)

```bash
cd apps/topout/frontend

# Link to a new Vercel project (interactive on first run: pick scope, accept project name)
vercel link

# Set Vercel env vars (production scope)
vercel env add NEXT_PUBLIC_CONVEX_URL production    # paste <prod>.convex.cloud URL from Phase 2
vercel env add CONVEX_DEPLOY_KEY production         # paste prod deploy key from Phase 2

# Deploy
vercel --prod
```

**Build command override:** in Vercel project settings → Build & Development Settings:

- Build Command: `pnpm exec convex deploy --cmd 'pnpm run build'`
  - This ensures `_generated/` exists in the peer `../convex/` directory before Next compiles. The `--cmd` flag runs the inner build only AFTER Convex codegen completes.

**Custom domain:** in Vercel project → Domains → add `topout.smagowskiai.dev`. Vercel emits the required CNAME target.

**Cloudflare CNAME:** add `topout → cname.vercel-dns.com`, DNS-only (not proxied).

Wait ~1 min for Vercel to verify domain ownership.

**Smoke test:** `https://topout.smagowskiai.dev/sign-in` → 200.

→ PAUSE for verdict.

### Phase 5 — End-to-end smoke (user + Claude, ~5 min)

| Step | Expected |
|---|---|
| Visit `topout.smagowskiai.dev` | redirects to `/sign-in`, 200 |
| Register with `smagowski.szymon@gmail.com` | success → `/dashboard` |
| Sign out, try registering `random@example.com` | red error: "Registration is invite-only" |
| Log a session with ≥1 attempt | session detail renders; AI summary fires in ~3-5s |
| `/reports` → click "Generate report" | report row appears; status flips pending → ok |
| Open Langfuse UI (apartment-VM-hosted) | trace for the report visible |
| `pnpm seed --reports 4` against prod | **blocked** by prod guard (correct) |

## Risks to watch

- **Build-time `_generated/`** — Vercel needs `convex/_generated/` before Next compiles. The `convex deploy --cmd` wrapper handles it; verify first build succeeds in Vercel logs.
- **Caddy + Let's Encrypt rate limits** — if the apartment VM churned subdomains recently, LE may rate-limit cert issuance. CloudEngineer should check `journalctl -u caddy` on cert errors.
- **Convex Auth `SITE_URL` mismatch** — must match the apex domain Vercel serves. Already in the Phase 2 env-set step.
- **Sidecar cold start** — first AI summary after deploy is ~3-5s slower. Not a bug.
- **Convex prod URL** — if the deployment is ever deleted + recreated, the URL changes. Update Vercel env if that happens.

## Cost estimate

- Convex Cloud: free tier (1M function calls/month, 1GB storage) — plenty for solo demo
- Vercel: free tier (100GB bandwidth, 6000 build minutes) — plenty
- GCP apartment VM: already running, ~$10-15/month after the $300 free trial credits
- Langfuse: self-hosted on apartment VM, $0
- OpenAI: ~$0.001 per AI summary, ~$0.01 per weekly report. Negligible.

## Repo state when this plan was written

- HEAD: `8089ce0` — `feat(auth): server-side email allowlist for invite-only registration`
- All work pushed to `github.com/SzymonSmagowski/topout`
- Local services shut down
- `convex/auth.ts` profile() throws `email_not_allowlisted` when `ALLOWED_REGISTRATION_EMAILS` is set and the email doesn't match (case-insensitive; `@topout.local` exempt)
- Test suite: 74 tests passing in <2s locally (5 sidecar + 2 contract + 4 component vitest + 1 e2e skipped)
