#!/bin/zsh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_DIR"

echo "[1/5] Switching to backend branch..."
git checkout backend

echo "[2/5] Pulling latest backend..."
git pull origin backend

echo "[3/5] Installing frontend dependencies..."
pnpm install

echo "[4/5] Installing backend dependencies..."
pnpm --dir backend install

echo "[5/5] Starting backend and frontend..."
pnpm --dir backend run start:dev &
BACKEND_PID=$!

cleanup() {
  echo "Stopping backend (PID: $BACKEND_PID)..."
  kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

pnpm dev
