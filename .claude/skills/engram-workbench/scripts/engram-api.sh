#!/usr/bin/env bash
# Thin curl wrapper for Engram HTTP API. API-only — does not touch ENGRAM_STORE_DIR files.
set -euo pipefail

BASE="${ENGRAM_URL:-http://localhost:8787}"

usage() {
  cat <<'EOF'
Usage: engram-api.sh <command> [args]

Commands:
  status              GET /status
  capture <text> [src] POST /activities (source defaults to claude-skill)
  dream               POST /dreams/run (extract → pending)
  dream-retry <reason> POST /dreams/retry (discard + same scope + reason)
  dream-cancel        POST /dreams/cancel (running job only)
  pending             GET /dreams/pending
  approve             POST /dreams/approve
  discard             POST /dreams/discard
  memory-l1           GET /memories/short-term-memory
  memory-search <q> [scope]  GET /memories/search (scope: l1,nodes,chain,future)
  memory-ask <q> [include_later]  POST /memories/ask (include_later: true|false, default false)
  memory-ask-get <id> GET /memories/ask/{job_id}
  memory-ask-cancel <id> POST /memories/ask/{job_id}/cancel
  future-sight        GET /memories/future-sight (active anchors; sweeps expired)
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
      | curl -sS -X POST "$BASE/activities" -H 'content-type: application/json' -d @-
    ;;
  dream)
    curl -sS -X POST "$BASE/dreams/run"
    ;;
  dream-retry)
    reason="${1:?usage: engram-api.sh dream-retry <reason>}"
    python3 -c 'import json,sys; print(json.dumps({"reason":sys.argv[1]}))' "$reason" \
      | curl -sS -X POST "$BASE/dreams/retry" -H 'content-type: application/json' -d @-
    ;;
  dream-cancel)
    curl -sS -X POST "$BASE/dreams/cancel" -H 'content-type: application/json' -d '{}'
    ;;
  pending)
    curl -sS "$BASE/dreams/pending"
    ;;
  approve)
    curl -sS -X POST "$BASE/dreams/approve" -H 'content-type: application/json' -d '{}'
    ;;
  discard)
    curl -sS -X POST "$BASE/dreams/discard" -H 'content-type: application/json' -d '{}'
    ;;
  memory-l1)
    curl -sS "$BASE/memories/short-term-memory"
    ;;
  memory-search)
    q="${1:?usage: engram-api.sh memory-search <query> [scope]}"
    scope="${2:-}"
    enc=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$q")
    if [[ -n "$scope" ]]; then
      sc=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$scope")
      curl -sS "$BASE/memories/search?q=$enc&scope=$sc"
    else
      curl -sS "$BASE/memories/search?q=$enc"
    fi
    ;;
  memory-ask)
    q="${1:?usage: engram-api.sh memory-ask <question> [include_later]}"
    later="${2:-false}"
    if [[ "$later" != "true" && "$later" != "false" ]]; then
      echo "include_later must be true or false" >&2
      exit 1
    fi
    python3 -c 'import json,sys; print(json.dumps({"q":sys.argv[1],"include_later":sys.argv[2]=="true"}))' "$q" "$later" \
      | curl -sS -X POST "$BASE/memories/ask" -H 'content-type: application/json' -d @-
    ;;
  memory-ask-get)
    id="${1:?usage: engram-api.sh memory-ask-get <job_id>}"
    curl -sS "$BASE/memories/ask/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$id")"
    ;;
  memory-ask-cancel)
    id="${1:?usage: engram-api.sh memory-ask-cancel <job_id>}"
    curl -sS -X POST "$BASE/memories/ask/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$id")/cancel" \
      -H 'content-type: application/json' -d '{}'
    ;;
  future-sight|future_sight)
    curl -sS "$BASE/memories/future-sight"
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
