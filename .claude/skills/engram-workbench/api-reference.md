# Engram API Reference (workbench)

Canonical spec: [../../../docs/api-docs/api.md](../../../docs/api-docs/api.md)

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |

## Helper script

```bash
.claude/skills/engram-workbench/scripts/engram-api.sh <command> [args]
```

Commands: `status` | `capture` | `dream` | `dream-retry` | `dream-amend` | `dream-cancel` | `pending` | `approve` | `discard` | `memory-l1` | `memory-search` | `memory-ask` | `memory-ask-get` | `memory-ask-cancel` | `future-sight` | `root`

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
curl -s "$ENGRAM_URL/memories/short-term-memory"
curl -s "$ENGRAM_URL/memory/search?q=alice&scope=nodes,chain"
curl -s -X POST "$ENGRAM_URL/memory/ask" \
  -H 'content-type: application/json' \
  -d '{"q":"What about Alice?"}'
curl -s "$ENGRAM_URL/future-sight"
```

## Response cheat sheet

### `GET /status`

Includes `dream_status`, `dream_pending`, `l1_clear_pending`, `future_sight_active_count`, `future_sight_hot_count`, `future_sight_later_count`, `future_sight_window_days`, `future_sight_hot_days`, `dream_job`, `ask_job`.

### `GET /dreams/pending`

Always 200. `present: false` when empty.

### `POST /dreams/approve`

May return `409` with `future_chain_id` + `rejected_chain_ids`, or `stale_future_anchor` + `rejected_future_ids` (pending kept).

### `GET /memories/search`

`q` required. `scope` optional (`l1,nodes,chain,future`; default all four). `future` sweeps hot＋later (no later-only flag). Returns only requested scopes with keyword hits; when `future` in scope, includes `future_sight[]` with `zone`.

### `POST /memories/ask`

Body: `q` required; optional boolean `include_later` (default false). Non-boolean → `400 invalid_include_later`. Default: agent may read `hot.md`, not `later.md`. `include_later:true` allows later. Job／202 echo `include_later`.

### `GET /memories/future-sight`

Always 200. Expire-only maintain（過期 → L0+short-term + 從 `hot.md`／`later.md` 移除 + 可 git commit），回傳帶 `zone` 的 `anchors`（先 hot 再 later）。不重桶。無 `/future-sight/expired`。

### Dream status

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No successful extract yet |
| `pending_review` | Awaiting approve／discard／retry／amend |
| `l1_clear_pending` | Retry approve to clear S only |
| `dream_incomplete` | Extract／materialize failed; L1 kept |
| `ok` | Steady |

## Strict fields

| Call | Use | Not |
|------|-----|-----|
| capture | `raw` | `content`, `text` |
| memory search | `q`, `scope` | `query`, `search` (as param name) |
| memory ask | `q`, `include_later` (boolean) | `question`, `query`; string `"true"` for include_later |
