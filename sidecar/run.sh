#!/usr/bin/env bash
# Launch the topout Python sidecar via uvicorn.
# Called by apps/topout/dev.sh; also runnable standalone.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Poetry may live in /usr/local/bin or ~/.local/bin depending on image age.
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

# Default port matches .env.example and the Convex PYTHON_SIDECAR_URL default.
PORT="${PORT:-8000}"

exec poetry run uvicorn src.main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --reload
