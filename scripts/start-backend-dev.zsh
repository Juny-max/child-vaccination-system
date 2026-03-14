#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3001

PIDS=$(lsof -ti tcp:$PORT || true)
if [[ -n "$PIDS" ]]; then
  echo "Port $PORT is in use. Stopping process(es): $PIDS"
  kill $PIDS || true
  sleep 1
fi

exec pnpm --dir "$ROOT_DIR/backend" run start:dev:raw
