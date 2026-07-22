#!/usr/bin/env bash
# Thin curl wrapper for Engram HTTP API. API-only — does not touch ENGRAM_HOME files.
set -euo pipefail

BASE="${ENGRAM_URL:-http://localhost:8787}"

usage() {
  cat <<'EOF'
Usage: engram-api.sh <command> [args]

Commands:
  status              GET /status
  capture <text> [src] POST /capture (source defaults to claude-skill)
  dream               POST /dream/run (extract → pending)
  pending             GET /dream/pending
  approve             POST /dream/approve
  discard             POST /dream/discard
  recall [q]          GET /recall (optional query)
  future-sight        GET /future-sight (active anchors; sweeps expired)
  root                GET /

Environment:
  ENGRAM_URL          Base URL (default http://localhost:8787)
EOF
}

cmd="${1:-}"
shift || true

case "$cmd" in
  status)
    curl -sS "$BASE/status"
    ;;
  capture)
    text="${1:?usage: engram-api.sh capture <text> [source]}"
    source="${2:-claude-skill}"
    python3 -c 'import json,sys; print(json.dumps({"raw":sys.argv[1],"source":sys.argv[2]}))' "$text" "$source" \
      | curl -sS -X POST "$BASE/capture" -H 'content-type: application/json' -d @-
    ;;
  dream)
    curl -sS -X POST "$BASE/dream/run"
    ;;
  pending)
    curl -sS "$BASE/dream/pending"
    ;;
  approve)
    curl -sS -X POST "$BASE/dream/approve" -H 'content-type: application/json' -d '{}'
    ;;
  discard)
    curl -sS -X POST "$BASE/dream/discard" -H 'content-type: application/json' -d '{}'
    ;;
  recall)
    if [[ -n "${1:-}" ]]; then
      q=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$1")
      curl -sS "$BASE/recall?q=$q"
    else
      curl -sS "$BASE/recall"
    fi
    ;;
  future-sight|future_sight)
    curl -sS "$BASE/future-sight"
    ;;
  root|"")
    curl -sS "$BASE/"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
