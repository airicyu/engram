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
curl -s -X POST http://localhost:8787/dreams/run
# poll /status until dream_status=pending_review
curl -s http://localhost:8787/dreams/pending
curl -s -X POST http://localhost:8787/dreams/approve
curl -s 'http://localhost:8787/memories/short-term-memory'
curl -s 'http://localhost:8787/memories/search?q=keyword&scope=nodes,chain'
curl -s 'http://localhost:8787/memories/chain'
curl -s 'http://localhost:8787/memories/nodes'
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
| `POST` | `/activities` | Append L0 event + update short-term pool |
| `POST` | `/dreams/run` | Extract→draft→pending（async 202）；空 pool 且有 closed higher catch-up → **rollup-only** 202；空且無事可做 → **409** `nothing_to_dream`；已有 pending → **409** `pending_review` |
| `GET` | `/dreams/pending` | Active pending report + patches (`present: false` if none) |
| `POST` | `/dreams/approve` | `commitDraft` → L2, clear scope S |
| `POST` | `/dreams/discard` | Drop pending + draft; short-term／L2 unchanged |
| `POST` | `/dreams/retry` | Discard pending → re-extract same scope with reason (async 202) |
| `POST` | `/dreams/cancel` | Cancel running dream (kill agent + revert draft) |
| `GET` | `/memories/future-sight` | Active near-horizon anchors (sweeps expired first) |
| `GET` | `/memories/short-term-memory` | Short-term preview for Activities |
| `GET` | `/memories/search` | Keyword search (`q` required; optional `scope=l1,nodes,chain`) |
| `GET` | `/memories/chain` | Day chain index (browse) |
| `GET` | `/memories/chain/{day_id}` | Day chain detail |
| `GET` | `/memories/nodes` | L2 node index (browse) |
| `GET` | `/memories/nodes/{node_id}` | L2 node detail (what Current) |
| `POST` | `/memories/ask` | Start async AI ask |
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
| **short-term memory** | Short-term pool (`memories/short-term-memory/pool.jsonl`); cleared by event-id scope S on approve. HTTP wire still uses `l1`／`l1_empty` etc. |
| **dream staging intent** | Patches + report (`dreams/patches.jsonl`, `dreams/reports/`) — short-term→L2 intermediate |
| **dream staging draft** | Staged L2 projection (`dreams/draft/{run_id}/`) — not live until approve |
| **L2** | Long-term node understanding (`memories/nodes/{id}/understand/what.md`) |
| **chain** | World timeline (`memories/chain/days|weeks|months|years/`) — day dual-track; higher summary-only |
| **future-sight** | Near-horizon anchors (`memories/future-sight/hot.md`＋`later.md`) — not memory-chain; not in `/memories/search` |
| **candidates** | Low-confidence attribution (`dreams/candidates/`) — not the primary create-node path |

**Lock rule:** capture is blocked only while extract/materialize/commit holds the dream lock. **`pending_review` allows capture** (new events ∉ frozen S).

## What the API does *not* expose (prototype)

These require manual steps (or future APIs):

- Node merge / fusion
- Wipe store → `cd server && bun run reset` (destructive; confirm first)
