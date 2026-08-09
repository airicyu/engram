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

Commands: `status` | `capture` | `attachment-upload` | `attachment-delete-tmp` | `attachment-file` | `attachment-housekeep` | `dream` | `dream-retry` | `dream-amend` | `dream-cancel` | `pending` | `approve` | `discard` | `memory-l1` | `memory-search` | `memory-ask` | `memory-ask-get` | `memory-ask-cancel` | `future-sight` | `root`

## curl catalog

```bash
export ENGRAM_URL="${ENGRAM_URL:-http://localhost:8787}"

curl -s "$ENGRAM_URL/status"
curl -s -X POST "$ENGRAM_URL/activities" \
  -H 'content-type: application/json' \
  -d '{"raw":"記得明天開會","source":"claude-skill"}'
curl -s -X POST "$ENGRAM_URL/attachments/uploads" -F 'file=@photo.png'
curl -s "$ENGRAM_URL/attachments/file?path=_attachments/uploads/2026-08-09/photo.png" -o photo.png
curl -s -X DELETE "$ENGRAM_URL/attachments/uploads/tmp?day=2026-08-09&filename=photo.png"
curl -s -X POST "$ENGRAM_URL/attachments/housekeep"
curl -s -X POST "$ENGRAM_URL/dreams/run"
# poll until dream_status=pending_review
curl -s "$ENGRAM_URL/dreams/pending"
curl -s -X POST "$ENGRAM_URL/dreams/approve" -H 'content-type: application/json' -d '{}'
curl -s "$ENGRAM_URL/memories/short-term-memory"
curl -s "$ENGRAM_URL/memories/search?q=alice&scope=nodes,chain"
curl -s -X POST "$ENGRAM_URL/memories/ask" \
  -H 'content-type: application/json' \
  -d '{"q":"What about Alice?"}'
curl -s "$ENGRAM_URL/memories/future-sight"
```

## Attachments (0.29+)

1. `POST /attachments/uploads` — multipart field **`file`** → `201` + `{ path, day, filename }` (lands in tmp).
2. Build `raw` with exact embed `![[{path}]]` (no `|alias`; path must match response `path`).
3. `POST /activities` with `{ raw, attachments: [{ path, relationship }] }` — server moves tmp→formal and appends `## Attachment relationships` appendix.
4. Preview: `GET /attachments/file?path=…`
5. Compose cancel: `DELETE /attachments/uploads/tmp?day=&filename=` (idempotent).
6. Manual tmp cleanup: `POST /attachments/housekeep`

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
| capture with images | `raw` + `attachments[]` (`path`, `relationship`) | client-rendered appendix; `![[path\|alias]]` |
| attachment upload | multipart `file` | `image`, `upload` |
| memory search | `q`, `scope` | `query`, `search` (as param name) |
| memory ask | `q`, `include_later` (boolean) | `question`, `query`; string `"true"` for include_later |
