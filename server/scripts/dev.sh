#!/usr/bin/env bash
# Dev entry: free listen port, then run bun --watch (avoids stale EADDRINUSE orphans).
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
PORT="${PORT:-8787}"

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
  exec bun --watch --env-file="$ENV_FILE" run src/index.ts
fi
exec bun --watch run src/index.ts
