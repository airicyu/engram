#!/usr/bin/env bash
# Run API + web together: line prefixes, shared Ctrl+C, fail-fast if either exits.
set -uo pipefail
set -m

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CYAN=$'\033[36m'
MAGENTA=$'\033[35m'
RESET=$'\033[0m'
SERVER_PORT="${PORT:-8787}"
WEB_PORT="${WEB_PORT:-8788}"
KILL_PORT="$ROOT/.claude/skills/kill-port/scripts/kill-port.sh"

SERVER_PID=""
WEB_PID=""
SHUTTING_DOWN=0

prefix_stream() {
  local label="$1"
  local color="$2"
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '%s[%s]%s %s\n' "$color" "$label" "$RESET" "$line"
  done
}

# Kill a process group (job-control leader) then any remaining descendants.
kill_job() {
  local pid="$1"
  local sig="${2:-TERM}"
  [[ -z "$pid" ]] && return 0
  kill "-$sig" -- "-$pid" 2>/dev/null || true
  kill "-$sig" "$pid" 2>/dev/null || true
  local child
  while read -r child; do
    [[ -n "$child" ]] && kill "-$sig" "$child" 2>/dev/null || true
  done < <(pgrep -P "$pid" 2>/dev/null || true)
}

free_ports() {
  for port in "$SERVER_PORT" "$WEB_PORT"; do
    if [[ -x "$KILL_PORT" ]]; then
      "$KILL_PORT" "$port" >/dev/null 2>&1 || true
    else
      local pids
      pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
      [[ -n "$pids" ]] && kill -TERM $pids 2>/dev/null || true
    fi
  done
}

shutdown() {
  local code="${1:-0}"
  if [[ "$SHUTTING_DOWN" -eq 1 ]]; then
    return
  fi
  SHUTTING_DOWN=1
  kill_job "$SERVER_PID" TERM
  kill_job "$WEB_PID" TERM
  sleep 0.3
  kill_job "$SERVER_PID" KILL
  kill_job "$WEB_PID" KILL
  free_ports
  wait 2>/dev/null || true
  exit "$code"
}

trap 'shutdown 130' INT
trap 'shutdown 143' TERM

bun run --cwd server dev > >(prefix_stream server "$CYAN") 2>&1 &
SERVER_PID=$!

bun run --cwd web dev > >(prefix_stream web "$MAGENTA") 2>&1 &
WEB_PID=$!

while true; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    wait "$SERVER_PID" 2>/dev/null
    code=$?
    [[ "$SHUTTING_DOWN" -eq 1 ]] && exit "$code"
    printf '%s[dev]%s server exited (%s); stopping web\n' "$CYAN" "$RESET" "$code" >&2
    shutdown "${code:-1}"
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    wait "$WEB_PID" 2>/dev/null
    code=$?
    [[ "$SHUTTING_DOWN" -eq 1 ]] && exit "$code"
    printf '%s[dev]%s web exited (%s); stopping server\n' "$MAGENTA" "$RESET" "$code" >&2
    shutdown "${code:-1}"
  fi
  sleep 0.2
done
