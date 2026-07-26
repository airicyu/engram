# Engram API Reference (workbench)

Canonical spec: [../../../api-docs/api.md](../../../api-docs/api.md)

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |

## Helper script

```bash
.claude/skills/engram-workbench/scripts/engram-api.sh <command> [args]
```

Commands: `status` | `capture` | `dream` | `dream-retry` | `dream-cancel` | `pending` | `approve` | `discard` | `memory-l1` | `memory-search` | `memory-ask` | `memory-ask-get` | `memory-ask-cancel` | `future-sight` | `root`

## curl catalog

```bash
export ENGRAM_URL="${ENGRAM_URL:-http://localhost:8787}"

curl -s "$ENGRAM_URL/status"
curl -s -X POST "$ENGRAM_URL/capture" \
  -H 'content-type: application/json' \
  -d '{"raw":"記得明天開會","source":"claude-skill"}'
curl -s -X POST "$ENGRAM_URL/dream/run"
# poll until dream_status=pending_review
curl -s "$ENGRAM_URL/dream/pending"
curl -s -X POST "$ENGRAM_URL/dream/approve" -H 'content-type: application/json' -d '{}'
curl -s "$ENGRAM_URL/memory/l1"
curl -s "$ENGRAM_URL/memory/search?q=alice&scope=nodes,chain"
curl -s -X POST "$ENGRAM_URL/memory/ask" \
  -H 'content-type: application/json' \
  -d '{"q":"What about Alice?"}'
curl -s "$ENGRAM_URL/future-sight"
```

## Response cheat sheet

### `GET /status`

Includes `dream_status`, `dream_pending`, `l1_clear_pending`, `future_sight_active_count`, `dream_job`, `ask_job`.

### `GET /dream/pending`

Always 200. `present: false` when empty.

### `POST /dream/approve`

May return `409` with `future_chain_id` + `rejected_chain_ids`, or `stale_future_anchor` + `rejected_future_ids` (pending kept).

### `GET /memory/search`

`q` required. `scope` optional (`l1,nodes,chain`; default all). Returns only requested scopes with keyword hits.

### `GET /future-sight`

Always 200. Sweeps expired anchors (L0+L1 event + hard delete), then returns active `anchors`. No `/future-sight/expired`.

### Dream status

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No successful extract yet |
| `pending_review` | Awaiting approve／discard／retry |
| `l1_clear_pending` | Retry approve to clear S only |
| `dream_incomplete` | Extract／materialize failed; L1 kept |
| `dead_letter_pending` | Legacy DLQ |
| `ok` | Steady |

## Strict fields

| Call | Use | Not |
|------|-----|-----|
| capture | `raw` | `content`, `text` |
| memory search | `q`, `scope` | `query`, `search` (as param name) |
| memory ask | `q` | `question`, `query` |
