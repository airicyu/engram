#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
ENV_FILE="$REPO/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
PORT="${WEB_PORT:-8788}"

free_port() {
  local pids
  pids="$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  echo "freeing port $PORT (pids: $pids)"
  kill $pids 2>/dev/null || true
  sleep 0.2
  pids="$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
}

free_port
cd "$ROOT"
if [[ -f "$ENV_FILE" ]]; then
  exec bun --env-file="$ENV_FILE" x vite --port "$PORT"
fi
exec bunx vite --port "$PORT"
