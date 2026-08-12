#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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
exec bunx vite --port "$PORT"
