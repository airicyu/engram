# Engram API Reference (workbench)

Canonical spec: [../../../docs/api-docs/api.md](../../../docs/api-docs/api.md)

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |

## Helper script

```bash
# from this skill directory
./scripts/engram-api.sh <command> [args]
```

Commands: `status` | `capture` | `attachment-upload` | `attachment-delete-tmp` | `attachment-file` | `attachment-housekeep` | `dream` | `dream-retry` | `dream-amend` | `dream-cancel` | `pending` | `pending-involvement` | `dream-events` | `approve` | `discard` | `memory-l1` | `memory-search` | `memory-ask` | `memory-ask-get` | `memory-ask-cancel` | `future-sight` | `clarify-asking` | `clarify-submit` | `clarify-dismiss` | `clarify-aside` | `chain` | `chain-detail` | `nodes` | `node` | `clock` | `clock-set` | `clock-clear` | `root`

`memory-l1` = `GET /memories/short-term-memory`（產品語意＝short-term；wire 仍用 `l1`／`l1_empty`）。

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
# 202 job_id | 409 pending_review | 409 nothing_to_dream | rollup-only 202 when pool empty + catch-up
# poll until dream_status=ok (default auto-approve) or pending_review
curl -s "$ENGRAM_URL/dreams/pending"
curl -s "$ENGRAM_URL/dreams/events"
curl -s -X PATCH "$ENGRAM_URL/dreams/pending/node-score-involvements" \
  -H 'content-type: application/json' -d '{"id":"acme","category":"focus"}'
curl -s -X POST "$ENGRAM_URL/dreams/retry" \
  -H 'content-type: application/json' -d '{"reason":"merge timeline better"}'
curl -s -X POST "$ENGRAM_URL/dreams/amend" \
  -H 'content-type: application/json' -d '{"instruction":"Fix the day summary typo"}'
curl -s -X POST "$ENGRAM_URL/dreams/approve" -H 'content-type: application/json' -d '{}'
curl -s "$ENGRAM_URL/memories/short-term-memory"
curl -s "$ENGRAM_URL/memories/search?q=alice&scope=nodes,chain,future"
curl -s "$ENGRAM_URL/memories/chain"
curl -s "$ENGRAM_URL/memories/chain/2026-07-23"
curl -s "$ENGRAM_URL/memories/chain/weeks"
curl -s "$ENGRAM_URL/memories/nodes"
curl -s "$ENGRAM_URL/memories/nodes/graph"
curl -s "$ENGRAM_URL/memories/nodes/acme"
curl -s -X POST "$ENGRAM_URL/memories/ask" \
  -H 'content-type: application/json' \
  -d '{"q":"What about Alice?"}'
curl -s "$ENGRAM_URL/memories/future-sight"
curl -s "$ENGRAM_URL/memories/clarify/asking"
curl -s -X POST "$ENGRAM_URL/memories/clarify/aside" \
  -H 'content-type: application/json' -d '{"raw":"補充：合約其實兩年"}'
curl -s -X POST "$ENGRAM_URL/memories/clarify/asking/ask-xxx/submit" \
  -H 'content-type: application/json' -d '{"answer":"兩年"}'
curl -s -X DELETE "$ENGRAM_URL/memories/clarify/asking/ask-xxx"
curl -s "$ENGRAM_URL/clock"
curl -s -X PUT "$ENGRAM_URL/clock" \
  -H 'content-type: application/json' -d '{"now":"2026-07-23T12:00:00+08:00"}'
curl -s -X DELETE "$ENGRAM_URL/clock"
```

## Attachments (0.29+)

1. `POST /attachments/uploads` — multipart field **`file`** → `201` + `{ path, day, filename }` (lands in tmp).
2. Build `raw` with exact embed `![[{path}]]` (no `|alias`; path must match response `path`).
3. `POST /activities` with `{ raw, attachments: [{ path, relationship }] }` — server moves tmp→formal and appends `## Attachment relationships` appendix.
4. Preview: `GET /attachments/file?path=…`
5. Compose cancel: `DELETE /attachments/uploads/tmp?day=&filename=` (idempotent).
6. Manual tmp cleanup: `POST /attachments/housekeep`

## Clarify (0.30+)

| Call | Body／notes |
|------|-------------|
| `GET /memories/clarify/asking` | `{ items: [...] }`；空＝`{ "items": [] }` |
| `POST …/asking/{id}/submit` | `{ answer }` |
| `DELETE …/asking/{id}` | dismiss；缺檔 200 |
| `POST /memories/clarify/aside` | `{ raw }` → **201**；非 L0 |

Dream lock → `409 dream_locked`. `pending_review` may still write.

## Empty pool / rollup-only (0.24+)

`POST /dreams/run`: pool empty + closed higher catch-up → **202** rollup-only；else **409** `nothing_to_dream`. Pending → **409** `pending_review`.

## Response cheat sheet

### `GET /status`

Includes `dream_status`, `dream_pending`, `l1_clear_pending`, `future_sight_*`, `dream_job`, **`ask_job`**, `clock`, `store_version`／`product_version`.

### `GET /dreams/pending`

Always 200. `present: false` when empty.

### `POST /dreams/approve`

May return `409` with `future_chain_id` + `rejected_chain_ids`, or `stale_future_anchor` + `rejected_future_ids` (pending kept).

### `GET /memories/search`

`q` required. `scope` optional (`l1,nodes,chain,future`; default all four). `future` sweeps hot＋later (no later-only flag). Returns only requested scopes with keyword hits; when `future` in scope, includes `future_sight[]` with `zone`.

### `POST /memories/ask`

Body: `q` required. **Do not** send `include_later`（0.34 removed → `400 include_later_removed`）. Agent may read `hot.md` and `later.md`; it decides what to cite. `202` `{ job_id, status }` — no `include_later` echo.

### `GET /memories/future-sight`

Always 200. Expire-only maintain（過期 → L0+short-term + 從 `hot.md`／`later.md` 移除 + 可 git commit），回傳帶 `zone` 的 `anchors`（先 hot 再 later）。不重桶。無 `/future-sight/expired`。

### Dream status

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No successful extract yet |
| `pending_review` | Awaiting approve／discard／retry／amend |
| `l1_clear_pending` | Retry approve to clear S only（short-term） |
| `dream_incomplete` | Extract／materialize failed; short-term kept |
| `ok` | Steady |

## Strict fields

| Call | Use | Not |
|------|-----|-----|
| capture | `raw` | `content`, `text` |
| capture with images | `raw` + `attachments[]` (`path`, `relationship`) | client-rendered appendix; `![[path\|alias]]` |
| attachment upload | multipart `file` | `image`, `upload` |
| memory search | `q`, `scope` | `query`, `search` (as param name) |
| memory ask | `q` | `question`, `query`, `include_later` |
| dream retry | `reason` | empty body |
| dream amend | `instruction` | empty body |
| clarify aside | `raw` | `content`, `text` |
| clarify submit | `answer` | `raw`, `text` |
