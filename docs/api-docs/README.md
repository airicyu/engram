# Engram API Documentation

HTTP API for the Engram memory prototype: **capture → dream (draft files + report) → approve (deploy + git) → memory**.

**Runtime deps:** Bun, **Git** (store must be a local repo), Agent CLI (Claude／Cursor／Codex).

## Quick start

```bash
cd server
bun install
bun run reset    # optional: wipe ENGRAM_STORE_DIR to empty store
bun run start    # listens on http://localhost:8787
```

```bash
curl -s http://localhost:8787/status
curl -s -X POST http://localhost:8787/activities \
  -H 'content-type: application/json' \
  -d '{"raw":"今天和同事討論了…","source":"api"}'
# optional (0.29+): upload image, then capture with embed + attachments[]
curl -s -X POST http://localhost:8787/attachments/uploads -F 'file=@photo.png'
curl -s -X POST http://localhost:8787/dreams/run
# poll /status until dream_status=pending_review
curl -s http://localhost:8787/dreams/pending
curl -s -X POST http://localhost:8787/dreams/approve
curl -s 'http://localhost:8787/memories/short-term-memory'
curl -s 'http://localhost:8787/memories/search?q=keyword&scope=nodes,chain'
curl -s 'http://localhost:8787/memories/chain'
curl -s 'http://localhost:8787/memories/nodes'
# optional (0.30+): clarify aside / list asking
curl -s -X POST http://localhost:8787/memories/clarify/aside \
  -H 'content-type: application/json' -d '{"raw":"補充：合約其實兩年"}'
curl -s http://localhost:8787/memories/clarify/asking
curl -s http://localhost:8787/memories/clarify/pending
```

## Web UI

```bash
# terminal 1 — API
cd server && bun run start

# terminal 2 — UI (proxies /api → :8787)
cd web && bun run start
# open http://localhost:8788
```

See [`web/README.md`](../../web/README.md).

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `ENGRAM_STORE_DIR` | `../data`（repo `data/`） | Env：記憶庫絕對路徑（領域名是 **memory store／記憶庫**，不是本鍵名） |
| `PORT` | `8787` | HTTP listen port（綁 `127.0.0.1`） |
| `CLAUDE_BIN` | `claude` | Claude Code binary for dream extract |
| `CODEX_BIN` | `codex` | Codex CLI binary when `ENGRAM_AGENT=codex` |
| `ENGRAM_AGENT` | `claude` | `claude` \| `cursor` \| `codex` \| `mock-ok` \| `mock-fail` \| `mock-ask-ok` |
| `ENGRAM_ALLOW_VIRTUAL_CLOCK` | (off) | `1` = allow `PUT /clock` (time replay) |
| `ENGRAM_ATTACHMENT_MAX_BYTES` | `10485760` (10 MiB) | Max upload size per image (0.29+) |
| `ENGRAM_ATTACHMENT_TMP_RETENTION_DAYS` | `2` | Tmp upload retention days (0.29+) |

Workspace yaml keys: `attachment_max_bytes`, `attachment_tmp_retention_days`, `attachment_housekeep_cron`, etc. — see [configurations.md](../configurations.md).

## Base URL

```
http://localhost:${PORT:-8787}
```

No authentication in the prototype. Timestamps use effective timezone (workspace yaml → `ENGRAM_TZ` → `Asia/Hong_Kong`). Memory write language: workspace → `ENGRAM_MEMORY_LANGUAGE` → `en`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Service discovery |
| `GET` | `/status` | Lock, short-term empty (`l1_empty`), dream status, pending summary |
| `POST` | `/activities` | Append L0 event + update short-term pool（0.29+ 可選 `attachments[]`） |
| `POST` | `/attachments/uploads` | Upload image to tmp (`file` multipart; 201) |
| `GET` | `/attachments/file` | Serve attachment for preview (`?path=`) |
| `DELETE` | `/attachments/uploads/tmp` | Delete tmp upload (`?day=&filename=`; idempotent) |
| `POST` | `/attachments/housekeep` | Clean expired tmp upload dirs |
| `POST` | `/dreams/run` | Extract→draft→pending（async 202）；空 pool 且有 closed higher catch-up → **rollup-only** 202；空且無事可做 → **409** `nothing_to_dream`；已有 pending → **409** `pending_review` |
| `GET` | `/dreams/pending` | Active pending report + patches (`present: false` if none) |
| `PATCH` | `/dreams/pending/node-score-involvements` | Edit pending node-score involvement category |
| `GET` | `/dreams/events` | Recent dream job log events (debug) |
| `POST` | `/dreams/approve` | `commitDraft` → L2, clear scope S |
| `POST` | `/dreams/discard` | Drop pending + draft; short-term／L2 unchanged |
| `POST` | `/dreams/retry` | Discard pending → re-extract same scope with reason (async 202) |
| `POST` | `/dreams/amend` | Same `dream_run_id` minimal draft edit (async 202) |
| `POST` | `/dreams/cancel` | Cancel running dream (kill agent + revert draft) |
| `GET` | `/memories/future-sight` | Active near-horizon anchors (sweeps expired first). Workbench browse: `#/memory/future` (0.40+) |
| `GET` | `/memories/short-term-memory` | Short-term preview for Activities |
| `GET` | `/memories/search` | Keyword search (`q` required; optional `scope=l1,nodes,chain,future`) |
| `GET` | `/memories/chain` | Day chain index (browse) |
| `GET` | `/memories/chain/{day_id}` | Day chain detail |
| `GET` | `/memories/chain/weeks` · `/months` · `/years` | Higher-chain index |
| `GET` | `/memories/chain/weeks/{id}` · `/months/{id}` · `/years/{id}` | Higher-chain detail |
| `GET` | `/memories/nodes` | L2 node index (browse) |
| `GET` | `/memories/nodes/{node_id}` | L2 node detail (understanding) |
| `GET` | `/memories/clarify/asking` | List open clarify follow-ups (0.30+) |
| `POST` | `/memories/clarify/asking/{id}/submit` | Answer → pending (0.30+) |
| `DELETE` | `/memories/clarify/asking/{id}` | Dismiss asking (0.30+) |
| `POST` | `/memories/clarify/aside` | Freestyle aside → pending (0.30+；非 L0) |
| `POST` | `/memories/ask` | Start async AI ask |
| `GET` | `/memories/ask/recent` | Recent ask list (0.43+) |
| `GET` | `/memories/ask/{job_id}` | Poll ask job |
| `POST` | `/memories/ask/{job_id}/cancel` | Cancel running ask |
| `GET` | `/clock` | Memory-timeline clock snapshot |
| `PUT` | `/clock` | Set virtual now (`ENGRAM_ALLOW_VIRTUAL_CLOCK=1`) |
| `DELETE` | `/clock` | Clear virtual clock |

Full request/response schemas, error codes, and semantics: **[api.md](./api.md)**.

## Memory model (read-only context)

| Layer | Role |
|-------|------|
| **L0** | Append-only event log (`memories/activities/events.jsonl`) |
| **short-term memory** | Short-term pool (`memories/short-term-memory/pool.jsonl` only); cleared by event-id scope S on approve. HTTP wire still uses `l1`／`l1_empty` etc. GET returns `entries[]`. |
| **dream staging intent** | Patches + report (`dreams/patches.jsonl`, `dreams/reports/`) — short-term→L2 intermediate |
| **dream staging draft** | Staged L2 projection (`dreams/draft/{run_id}/`) — not live until approve |
| **L2** | Long-term node understanding — whole `memories/nodes/{id}/{id}.md` as standing understanding（API field `understanding`）；Obsidian vault＝`memories/` |
| **chain** | World timeline (`memories/chain/days|weeks|months|years/`) — day dual-track; higher summary-only |
| **future-sight** | Near-horizon anchors (`memories/future-sight/upcoming.md`＋`longTerm.md`) — not memory-chain; searchable via `/memories/search?scope=…,future`（default includes `future`） |
| **candidates** | Low-confidence attribution (`dreams/candidates/`) — not the primary create-node path |

**Lock rule:** extract／deploy 仍用 `dream.lock` 禁第二場夢與進行中的審核。`POST /activities`、upload、clarify 寫入 **不**因 lock 回 409；本場只消化開跑快照。**`pending_review` allows capture**.

## What the API does *not* expose (prototype)

These require manual steps (or future APIs):

- Node merge / fusion
- Wipe store → `cd server && bun run reset` (destructive; confirm first)
