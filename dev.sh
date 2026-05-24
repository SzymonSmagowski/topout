#!/usr/bin/env bash
# Start TopOut's frontend (Next.js), Convex dev server, and Python sidecar
# with color-coded interleaved logs. Ctrl+C — or any service exiting — tears
# everything down cleanly. Adapted from apps/portfolio-ai-lab/dev.sh.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT/frontend"
SIDECAR_DIR="$ROOT/sidecar"
# Poetry lands in /usr/local/bin on a fresh image, ~/.local/bin on a stale one.
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

kill_tree() {
    local parent=$1 sig=${2:-TERM} child
    for child in $(pgrep -P "$parent" 2>/dev/null); do
        kill_tree "$child" "$sig"
    done
    [ "$parent" != "$$" ] && kill -"$sig" "$parent" 2>/dev/null || true
}

cleanup() {
    trap - INT TERM
    printf "\n%b▸ Shutting down…%b\n" "$YELLOW" "$RESET"
    kill_tree $$ TERM
    sleep 1
    kill_tree $$ KILL
    exit 0
}
trap cleanup INT TERM

prefix() {
    local color=$1 tag=$2
    while IFS= read -r line; do
        printf "%b[%s]%b %s\n" "$color" "$tag" "$RESET" "$line"
    done
}

# Preflight
[ -d "$FRONTEND_DIR" ] || { printf "%b✗ %s not found%b\n" "$RED" "$FRONTEND_DIR" "$RESET"; exit 1; }
[ -d "$SIDECAR_DIR"  ] || { printf "%b✗ %s not found%b\n" "$RED" "$SIDECAR_DIR" "$RESET"; exit 1; }
command -v pnpm    >/dev/null || { printf "%b✗ pnpm not on PATH — run 'corepack enable && corepack prepare pnpm@latest --activate'%b\n" "$RED" "$RESET"; exit 1; }
command -v poetry  >/dev/null || { printf "%b✗ poetry not on PATH — rebuild the devcontainer%b\n" "$RED" "$RESET"; exit 1; }

printf "%b● frontend%b   → http://localhost:3000\n" "$MAGENTA" "$RESET"
printf "%b● convex dev%b → connects to the deployment in apps/topout/frontend/.env.local\n" "$CYAN" "$RESET"
printf "%b● sidecar%b    → http://localhost:8000\n" "$GREEN" "$RESET"
echo ""

# Next.js dev
( cd "$FRONTEND_DIR" && exec pnpm dev ) 2>&1 | prefix "$MAGENTA" "frontend" &

# Convex dev — keeps schema/codegen in sync as you edit convex/*.ts.
# Reads CONVEX_DEPLOYMENT from apps/topout/frontend/.env.local.
( cd "$FRONTEND_DIR" && exec pnpm convex dev ) 2>&1 | prefix "$CYAN" "convex" &

# Python sidecar
( cd "$SIDECAR_DIR" && exec ./run.sh ) 2>&1 | prefix "$GREEN" "sidecar" &

# If any service exits, tear down the others.
wait -n
cleanup
