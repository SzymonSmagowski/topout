#!/usr/bin/env bash
# One-shot bootstrap for the TopOut dev environment. Idempotent — safe to
# re-run. Detects what's missing and only does the missing pieces.
#
# Usage:   ./bootstrap.sh
# Then:    ./dev.sh
#
# Prereqs (devcontainer has these): pnpm, poetry, node 22+, openssl, curl.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT/frontend"
SIDECAR_DIR="$ROOT/sidecar"
CONVEX_DIR="$ROOT/convex"

# Look in this directory order for an existing OpenAI key to borrow.
KEY_SOURCES=(
    "$ROOT/../portfolio-ai-lab/backend/.env"
    "$ROOT/../fridge-chatbot/backend/.env"
)

GREEN='\033[0;32m' YELLOW='\033[1;33m' RED='\033[0;31m' CYAN='\033[0;36m' RESET='\033[0m'
step() { printf "${CYAN}▸ %s${RESET}\n" "$*"; }
ok()   { printf "${GREEN}✔ %s${RESET}\n" "$*"; }
warn() { printf "${YELLOW}⚠ %s${RESET}\n" "$*"; }
die()  { printf "${RED}✘ %s${RESET}\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. pnpm install — installs frontend deps. Workspace-aware.
# ---------------------------------------------------------------------------
step "pnpm install (frontend)"
( cd "$FRONTEND_DIR" && pnpm install --silent ) || die "pnpm install failed"
ok "node modules ready"

# ---------------------------------------------------------------------------
# 2. Symlink convex/node_modules → frontend/node_modules so the Convex
#    bundler can resolve `convex/server` when the functions dir is a peer.
# ---------------------------------------------------------------------------
if [ ! -L "$CONVEX_DIR/node_modules" ]; then
    step "symlink convex/node_modules"
    ln -sf ../frontend/node_modules "$CONVEX_DIR/node_modules"
    ok "convex bundler can now see node_modules"
fi

# ---------------------------------------------------------------------------
# 3. Convex CLI tmp dir on the same filesystem as the project.
# ---------------------------------------------------------------------------
mkdir -p "$ROOT/.convex-tmp"
export CONVEX_TMPDIR="$ROOT/.convex-tmp"

# ---------------------------------------------------------------------------
# 4. First-time Convex push. Generates _generated/ + registers schema.
#    `--once` exits cleanly instead of watching. `--typecheck disable`
#    skips Next's tsc pass which would fail on missing _generated until
#    this very command succeeds (chicken/egg).
# ---------------------------------------------------------------------------
if [ ! -f "$CONVEX_DIR/_generated/api.d.ts" ] || ! grep -q "import type" "$CONVEX_DIR/_generated/api.d.ts" 2>/dev/null; then
    step "pushing Convex schema + generating types"
    ( cd "$FRONTEND_DIR" && pnpm exec convex dev --once --typecheck disable )
    ok "convex/_generated/ populated"
else
    ok "convex/_generated/ already in place"
fi

# ---------------------------------------------------------------------------
# 5. Convex Auth keys (JWT_PRIVATE_KEY + JWKS + SITE_URL). The official
#    @convex-dev/auth CLI generates them and pushes via `convex env set`.
# ---------------------------------------------------------------------------
if ! ( cd "$FRONTEND_DIR" && npx convex env list 2>/dev/null | grep -q "^JWT_PRIVATE_KEY=" ); then
    step "generating Convex Auth keys (JWT + JWKS)"
    ( cd "$FRONTEND_DIR" && npx @convex-dev/auth --skip-git-check >/dev/null 2>&1 ) || warn "auth CLI nonzero — keys may still be set"
    ok "auth keys pushed to deployment"
else
    ok "Convex Auth keys already present"
fi

# ---------------------------------------------------------------------------
# 6. OpenAI key + sidecar secret. Borrow OpenAI key from a sibling app's
#    .env if not already set on Convex.
# ---------------------------------------------------------------------------
if ! ( cd "$FRONTEND_DIR" && npx convex env list 2>/dev/null | grep -q "^OPENAI_API_KEY=" ); then
    OPENAI_KEY=""
    for src in "${KEY_SOURCES[@]}"; do
        if [ -f "$src" ]; then
            OPENAI_KEY=$(grep -E "^OPENAI_API_KEY=" "$src" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
            [ -n "$OPENAI_KEY" ] && break
        fi
    done
    if [ -n "$OPENAI_KEY" ]; then
        step "setting OPENAI_API_KEY on Convex (borrowed from sibling app)"
        ( cd "$FRONTEND_DIR" && npx convex env set OPENAI_API_KEY "$OPENAI_KEY" >/dev/null )
        ok "OPENAI_API_KEY set"
    else
        warn "no OpenAI key found — AI summaries will fail. Set with:"
        warn "  cd frontend && npx convex env set OPENAI_API_KEY sk-..."
    fi
fi

if ! ( cd "$FRONTEND_DIR" && npx convex env list 2>/dev/null | grep -q "^SIDECAR_SECRET=" ); then
    SECRET=$(openssl rand -hex 32)
    step "generating SIDECAR_SECRET + pushing to Convex"
    ( cd "$FRONTEND_DIR" && npx convex env set SIDECAR_SECRET "$SECRET" >/dev/null )
    ok "SIDECAR_SECRET set"
fi

( cd "$FRONTEND_DIR" && npx convex env set PYTHON_SIDECAR_URL "http://host.docker.internal:8000" >/dev/null 2>&1 ) || true
( cd "$FRONTEND_DIR" && npx convex env set OPENAI_MODEL "gpt-5.4-nano" >/dev/null 2>&1 ) || true

# ---------------------------------------------------------------------------
# 7. Mirror the secrets into sidecar/.env so the Python service matches.
# ---------------------------------------------------------------------------
if [ ! -f "$SIDECAR_DIR/.env" ]; then
    step "writing sidecar/.env (mirrors Convex env)"
    OPENAI_KEY=$(cd "$FRONTEND_DIR" && npx convex env get OPENAI_API_KEY 2>/dev/null || echo "")
    SECRET=$(cd "$FRONTEND_DIR" && npx convex env get SIDECAR_SECRET 2>/dev/null || echo "")
    cat > "$SIDECAR_DIR/.env" <<EOF
PORT=8000
LOG_LEVEL=info
SIDECAR_SECRET=$SECRET
OPENAI_API_KEY=$OPENAI_KEY
OPENAI_MODEL=gpt-5.4-nano
LANGFUSE_HOST=http://langfuse-web:3000
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_ENVIRONMENT=development
EOF
    ok "sidecar/.env written"
else
    ok "sidecar/.env already exists"
fi

# ---------------------------------------------------------------------------
# 8. Poetry install for the sidecar.
# ---------------------------------------------------------------------------
if [ ! -d "$SIDECAR_DIR/.venv" ] && ! ( cd "$SIDECAR_DIR" && poetry env info -p >/dev/null 2>&1 ); then
    step "poetry install (sidecar)"
    ( cd "$SIDECAR_DIR" && poetry install --no-interaction --quiet )
    ok "sidecar venv ready"
else
    ok "sidecar venv already exists"
fi

# ---------------------------------------------------------------------------
# 9. Executable bits on the runner scripts.
# ---------------------------------------------------------------------------
chmod +x "$ROOT/dev.sh" "$SIDECAR_DIR/run.sh" 2>/dev/null || true

echo ""
ok "Bootstrap complete. Start the stack with:"
echo "    ./dev.sh"
echo ""
echo "  Frontend: http://localhost:3000"
echo "  Sidecar:  http://localhost:8000/health"
echo "  Convex:   http://127.0.0.1:3210"
echo ""
echo "  Optional — enable Langfuse traces:"
echo "    1. Open http://localhost:3001 (login dev@example.com / devpassword)"
echo "    2. Settings → API keys → copy public + secret"
echo "    3. Paste into sidecar/.env (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY)"
