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
  dream-cancel        POST /dream/cancel (running job only)
  pending             GET /dream/pending
  approve             POST /dream/approve
  discard             POST /dream/discard
  memory-l1           GET /memory/l1
  memory-search <q> [scope]  GET /memory/search (scope: l1,nodes,chain)
  memory-ask <q>      POST /memory/ask
  memory-ask-get <id> GET /memory/ask/{job_id}
  memory-ask-cancel <id> POST /memory/ask/{job_id}/cancel
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
  dream-cancel)
    curl -sS -X POST "$BASE/dream/cancel" -H 'content-type: application/json' -d '{}'
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
  memory-l1)
    curl -sS "$BASE/memory/l1"
    ;;
  memory-search)
    q="${1:?usage: engram-api.sh memory-search <query> [scope]}"
    scope="${2:-}"
    enc=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$q")
    if [[ -n "$scope" ]]; then
      sc=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$scope")
      curl -sS "$BASE/memory/search?q=$enc&scope=$sc"
    else
      curl -sS "$BASE/memory/search?q=$enc"
    fi
    ;;
  memory-ask)
    q="${1:?usage: engram-api.sh memory-ask <question>}"
    python3 -c 'import json,sys; print(json.dumps({"q":sys.argv[1]}))' "$q" \
      | curl -sS -X POST "$BASE/memory/ask" -H 'content-type: application/json' -d @-
    ;;
  memory-ask-get)
    id="${1:?usage: engram-api.sh memory-ask-get <job_id>}"
    curl -sS "$BASE/memory/ask/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$id")"
    ;;
  memory-ask-cancel)
    id="${1:?usage: engram-api.sh memory-ask-cancel <job_id>}"
    curl -sS -X POST "$BASE/memory/ask/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$id")/cancel" \
      -H 'content-type: application/json' -d '{}'
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
