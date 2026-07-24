# Engram API Documentation

HTTP API for the Engram memory prototype: **capture → dream extract (draft) → approve → memory**.

## Quick start

```bash
cd server
bun install
bun run reset    # optional: wipe ENGRAM_HOME to empty store
bun run start    # listens on http://localhost:8787
```

```bash
curl -s http://localhost:8787/status
curl -s -X POST http://localhost:8787/capture \
  -H 'content-type: application/json' \
  -d '{"raw":"今天和同事討論了…","source":"api"}'
curl -s -X POST http://localhost:8787/dream/run
# poll /status until dream_status=pending_review
curl -s http://localhost:8787/dream/pending
curl -s -X POST http://localhost:8787/dream/approve
curl -s 'http://localhost:8787/memory/l1'
curl -s 'http://localhost:8787/memory/search?q=keyword&scope=nodes,chain'
curl -s 'http://localhost:8787/memory/chain'
curl -s 'http://localhost:8787/memory/nodes'
```

## Web UI

```bash
# terminal 1 — API
cd server && bun run start

# terminal 2 — UI (proxies /api → :8787)
cd web && bun run start
# open http://localhost:8788
```

See [`web/README.md`](../web/README.md).

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `ENGRAM_HOME` | `../data` (repo `data/`) | Memory store root on disk |
| `PORT` | `8787` | HTTP listen port |
| `CLAUDE_BIN` | `claude` | Claude Code binary for dream extract |
| `ENGRAM_AGENT` | `cursor` | `cursor` \| `claude` \| `mock-ok` \| `mock-fail` \| `mock-ask-ok` |
| `ENGRAM_ALLOW_VIRTUAL_CLOCK` | (off) | `1` = allow `PUT /clock` (time replay) |

## Base URL

```
http://localhost:${PORT:-8787}
```

No authentication in the prototype. Timestamps use `ENGRAM_TZ` (default `Asia/Hong_Kong`).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Service discovery |
| `GET` | `/status` | Lock, L1, DLQ, dream status, pending summary |
| `POST` | `/capture` | Append L0 event + update L1 pool |
| `POST` | `/dream/run` | Extract → materialize draft → pending_review (async 202) |
| `GET` | `/dream/pending` | Active pending report + patches (`present: false` if none) |
| `POST` | `/dream/approve` | `commitDraft` → L2, clear scope S |
| `POST` | `/dream/discard` | Drop pending + draft; L1/L2 unchanged |
| `POST` | `/dream/cancel` | Cancel running dream (kill agent + revert draft) |
| `GET` | `/future-sight` | Active near-horizon anchors (sweeps expired first) |
| `GET` | `/memory/l1` | L1 preview for Capture |
| `GET` | `/memory/search` | Keyword search (`q` required; optional `scope=l1,nodes,chain`) |
| `GET` | `/memory/chain` | Day chain index (browse) |
| `GET` | `/memory/chain/{day_id}` | Day chain detail |
| `GET` | `/memory/nodes` | L2 node index (browse) |
| `GET` | `/memory/nodes/{node_id}` | L2 node detail (what Current) |
| `POST` | `/memory/ask` | Start async AI ask |
| `GET` | `/memory/ask/{job_id}` | Poll ask job |
| `POST` | `/memory/ask/{job_id}/cancel` | Cancel running ask |
| `GET` | `/clock` | Memory-timeline clock snapshot |
| `PUT` | `/clock` | Set virtual now (`ENGRAM_ALLOW_VIRTUAL_CLOCK=1`) |
| `DELETE` | `/clock` | Clear virtual clock |

Full request/response schemas, error codes, and semantics: **[api.md](./api.md)**.

## Memory model (read-only context)

| Layer | Role |
|-------|------|
| **L0** | Append-only event log (`log/events.jsonl`) |
| **L1** | Short-term mem pool (`short-term-memory/pool.jsonl`); cleared by event-id scope S on approve |
| **L1.5 intent** | Patches + report (`dream/patches.jsonl`, `dream/reports/`) — L1→L2 中間態 |
| **L1.5 draft** | Staged L2 projection (`dream/draft/{run_id}/`) — not live until approve |
| **L2** | Long-term node understanding (`nodes/{id}/understand/what.md`) |
| **chain** | World timeline days (`memory-chain/days/`) — occurrence dates only |
| **future-sight** | Near-horizon anchors (`future-sight/active/`) — not memory-chain; not in `/memory/search` |
| **candidates** | Low-confidence attribution etc. (`candidates/`) — not the primary create-node path |

**Lock rule:** capture is blocked only while extract/materialize/commit holds the dream lock. **`pending_review` allows capture** (new events ∉ frozen S).

## What the API does *not* expose (prototype)

These require manual steps (or future APIs):

- Settle `dead-letter.jsonl`
- Node merge / fusion
- Wipe store → `cd server && bun run reset` (destructive; confirm first)
