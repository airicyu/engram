# Engram API Reference (operator)

Canonical spec: [../../../api-docs/api.md](../../../api-docs/api.md)

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |

## Helper script

```bash
.claude/skills/engram-operator/scripts/engram-api.sh <command> [args]
```

Commands: `status` | `ingest` | `dream` | `pending` | `approve` | `discard` | `activate` | `root`

## curl catalog

```bash
export ENGRAM_URL="${ENGRAM_URL:-http://localhost:8787}"

curl -s "$ENGRAM_URL/status"
curl -s -X POST "$ENGRAM_URL/ingest" \
  -H 'content-type: application/json' \
  -d '{"raw":"記得明天開會","source":"claude-skill"}'
curl -s -X POST "$ENGRAM_URL/dream/run"
# poll until dream_status=pending_review
curl -s "$ENGRAM_URL/dream/pending"
curl -s -X POST "$ENGRAM_URL/dream/approve" -H 'content-type: application/json' -d '{}'
# or: curl -s -X POST "$ENGRAM_URL/dream/discard" -H 'content-type: application/json' -d '{}'
curl -s "$ENGRAM_URL/activate?q=alice"
```

## Response cheat sheet

### `GET /status`

Includes `dream_status`, `dream_pending`, `l1_clear_pending`, `dream_job` (with `phase`).

### `GET /dream/pending`

Always 200. `present: false` when empty.

### `POST /dream/approve`

May return `409` with `future_chain_id` + `rejected_chain_ids` (pending kept).

### Dream status

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No successful extract yet |
| `pending_review` | Awaiting approve／discard／supersede |
| `l1_clear_pending` | Retry approve to clear S only |
| `dream_incomplete` | Extract／materialize failed; L1 kept |
| `dead_letter_pending` | Legacy DLQ |
| `ok` | Steady |

## Strict fields

| Call | Use | Not |
|------|-----|-----|
| ingest | `raw` | `content`, `text` |
| activate | `q` | `query`, `search` |
