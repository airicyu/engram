#!/usr/bin/env bash
# Dev entry: free listen port, then run bun --watch (avoids stale EADDRINUSE orphans).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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
exec bun --watch run src/index.ts
