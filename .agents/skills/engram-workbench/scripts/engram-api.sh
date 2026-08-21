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
  attachment-upload <file> POST /attachments/uploads (multipart file)
  attachment-delete-tmp <day> <filename> DELETE /attachments/uploads/tmp
  attachment-file <path> [out] GET /attachments/file (default out: basename of path)
  attachment-housekeep POST /attachments/housekeep
  dream               POST /dreams/run (extract → pending; or rollup-only / nothing_to_dream)
  dream-retry <reason> POST /dreams/retry (discard + same scope + reason)
  dream-amend <instruction> POST /dreams/amend (same run_id + instruction)
  dream-cancel        POST /dreams/cancel (running job only)
  pending             GET /dreams/pending
  pending-involvement <id> <category> PATCH /dreams/pending/node-score-involvements
  dream-events        GET /dreams/events
  approve             POST /dreams/approve
  discard             POST /dreams/discard
  memory-l1           GET /memories/short-term-memory (short-term; wire alias l1)
  memory-search <q> [scope]  GET /memories/search (scope: l1,nodes,chain,future)
  memory-ask <q>          POST /memories/ask
  memory-ask-get <id> GET /memories/ask/{job_id}
  memory-ask-cancel <id> POST /memories/ask/{job_id}/cancel
  future-sight        GET /memories/future-sight (active anchors; sweeps expired)
  clarify-asking      GET /memories/clarify/asking
  clarify-pending     GET /memories/clarify/pending
  clarify-submit <id> <answer> POST /memories/clarify/asking/{id}/submit
  clarify-dismiss <id> DELETE /memories/clarify/asking/{id}
  clarify-aside <text> POST /memories/clarify/aside
  chain [level]       GET /memories/chain[/weeks|/months|/years] (default day)
  chain-detail <level> <id>  GET day|week|month|year detail
  nodes               GET /memories/nodes
  nodes-graph         GET /memories/nodes/graph
  node <id>           GET /memories/nodes/{id}
  clock               GET /clock
  clock-set <now-iso> PUT /clock (needs ENGRAM_ALLOW_VIRTUAL_CLOCK=1)
  clock-clear         DELETE /clock
  root                GET /

Environment:
  ENGRAM_URL          Base URL (default http://localhost:8787)
EOF
}

enc() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
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
  attachment-upload)
    file="${1:?usage: engram-api.sh attachment-upload <file>}"
    curl -sS -X POST "$BASE/attachments/uploads" -F "file=@${file}"
    ;;
  attachment-delete-tmp)
    day="${1:?usage: engram-api.sh attachment-delete-tmp <day> <filename>}"
    filename="${2:?usage: engram-api.sh attachment-delete-tmp <day> <filename>}"
    curl -sS -X DELETE "$BASE/attachments/uploads/tmp?day=$(enc "$day")&filename=$(enc "$filename")"
    ;;
  attachment-file)
    path="${1:?usage: engram-api.sh attachment-file <path> [outfile]}"
    out="${2:-$(basename "$path")}"
    curl -sS "$BASE/attachments/file?path=$(enc "$path")" -o "$out"
    ;;
  attachment-housekeep)
    curl -sS -X POST "$BASE/attachments/housekeep"
    ;;
  dream)
    curl -sS -X POST "$BASE/dreams/run"
    ;;
  dream-retry)
    reason="${1:?usage: engram-api.sh dream-retry <reason>}"
    python3 -c 'import json,sys; print(json.dumps({"reason":sys.argv[1]}))' "$reason" \
      | curl -sS -X POST "$BASE/dreams/retry" -H 'content-type: application/json' -d @-
    ;;
  dream-amend)
    instruction="${1:?usage: engram-api.sh dream-amend <instruction>}"
    python3 -c 'import json,sys; print(json.dumps({"instruction":sys.argv[1]}))' "$instruction" \
      | curl -sS -X POST "$BASE/dreams/amend" -H 'content-type: application/json' -d @-
    ;;
  dream-cancel)
    curl -sS -X POST "$BASE/dreams/cancel" -H 'content-type: application/json' -d '{}'
    ;;
  pending)
    curl -sS "$BASE/dreams/pending"
    ;;
  pending-involvement)
    id="${1:?usage: engram-api.sh pending-involvement <id> <category>}"
    category="${2:?usage: engram-api.sh pending-involvement <id> <category>}"
    python3 -c 'import json,sys; print(json.dumps({"id":sys.argv[1],"category":sys.argv[2]}))' "$id" "$category" \
      | curl -sS -X PATCH "$BASE/dreams/pending/node-score-involvements" -H 'content-type: application/json' -d @-
    ;;
  dream-events)
    curl -sS "$BASE/dreams/events"
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
    if [[ -n "$scope" ]]; then
      curl -sS "$BASE/memories/search?q=$(enc "$q")&scope=$(enc "$scope")"
    else
      curl -sS "$BASE/memories/search?q=$(enc "$q")"
    fi
    ;;
  memory-ask)
    q="${1:?usage: engram-api.sh memory-ask <question>}"
    python3 -c 'import json,sys; print(json.dumps({"q":sys.argv[1]}))' "$q" \
      | curl -sS -X POST "$BASE/memories/ask" -H 'content-type: application/json' -d @-
    ;;
  memory-ask-get)
    id="${1:?usage: engram-api.sh memory-ask-get <job_id>}"
    curl -sS "$BASE/memories/ask/$(enc "$id")"
    ;;
  memory-ask-cancel)
    id="${1:?usage: engram-api.sh memory-ask-cancel <job_id>}"
    curl -sS -X POST "$BASE/memories/ask/$(enc "$id")/cancel" \
      -H 'content-type: application/json' -d '{}'
    ;;
  future-sight|future_sight)
    curl -sS "$BASE/memories/future-sight"
    ;;
  clarify-asking)
    curl -sS "$BASE/memories/clarify/asking"
    ;;
  clarify-pending)
    curl -sS "$BASE/memories/clarify/pending"
    ;;
  clarify-submit)
    id="${1:?usage: engram-api.sh clarify-submit <id> <answer>}"
    answer="${2:?usage: engram-api.sh clarify-submit <id> <answer>}"
    python3 -c 'import json,sys; print(json.dumps({"answer":sys.argv[1]}))' "$answer" \
      | curl -sS -X POST "$BASE/memories/clarify/asking/$(enc "$id")/submit" \
        -H 'content-type: application/json' -d @-
    ;;
  clarify-dismiss)
    id="${1:?usage: engram-api.sh clarify-dismiss <id>}"
    curl -sS -X DELETE "$BASE/memories/clarify/asking/$(enc "$id")"
    ;;
  clarify-aside)
    text="${1:?usage: engram-api.sh clarify-aside <text>}"
    python3 -c 'import json,sys; print(json.dumps({"raw":sys.argv[1]}))' "$text" \
      | curl -sS -X POST "$BASE/memories/clarify/aside" -H 'content-type: application/json' -d @-
    ;;
  chain)
    level="${1:-day}"
    case "$level" in
      day|"") curl -sS "$BASE/memories/chain" ;;
      week|weeks) curl -sS "$BASE/memories/chain/weeks" ;;
      month|months) curl -sS "$BASE/memories/chain/months" ;;
      year|years) curl -sS "$BASE/memories/chain/years" ;;
      *)
        echo "usage: engram-api.sh chain [day|week|month|year]" >&2
        exit 1
        ;;
    esac
    ;;
  chain-detail)
    level="${1:?usage: engram-api.sh chain-detail <day|week|month|year> <id>}"
    id="${2:?usage: engram-api.sh chain-detail <day|week|month|year> <id>}"
    case "$level" in
      day) curl -sS "$BASE/memories/chain/$(enc "$id")" ;;
      week) curl -sS "$BASE/memories/chain/weeks/$(enc "$id")" ;;
      month) curl -sS "$BASE/memories/chain/months/$(enc "$id")" ;;
      year) curl -sS "$BASE/memories/chain/years/$(enc "$id")" ;;
      *)
        echo "usage: engram-api.sh chain-detail <day|week|month|year> <id>" >&2
        exit 1
        ;;
    esac
    ;;
  nodes)
    curl -sS "$BASE/memories/nodes"
    ;;
  nodes-graph)
    curl -sS "$BASE/memories/nodes/graph"
    ;;
  node)
    id="${1:?usage: engram-api.sh node <id>}"
    curl -sS "$BASE/memories/nodes/$(enc "$id")"
    ;;
  clock)
    curl -sS "$BASE/clock"
    ;;
  clock-set)
    now="${1:?usage: engram-api.sh clock-set <now-iso>}"
    python3 -c 'import json,sys; print(json.dumps({"now":sys.argv[1]}))' "$now" \
      | curl -sS -X PUT "$BASE/clock" -H 'content-type: application/json' -d @-
    ;;
  clock-clear)
    curl -sS -X DELETE "$BASE/clock"
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
