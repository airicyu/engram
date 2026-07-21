# Engram API Documentation

HTTP API for the Engram MVP memory prototype: **ingest → dream (extract + apply) → activate**.

## Quick start

```bash
cd server
bun install
bun run reset    # optional: wipe ENGRAM_HOME to empty store
bun run start    # listens on http://localhost:8787
```

```bash
curl -s http://localhost:8787/status
curl -s -X POST http://localhost:8787/ingest \
  -H 'content-type: application/json' \
  -d '{"raw":"今天和同事討論了…","source":"api"}'
curl -s -X POST http://localhost:8787/dream/run
curl -s 'http://localhost:8787/activate'
```

## Web UI (0.2.0)

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
| `ENGRAM_AGENT` | `cursor` | `cursor` \| `claude` \| `mock-ok` \| `mock-fail` (latter two for tests only) |

## Base URL

```
http://localhost:${PORT:-8787}
```

No authentication in the prototype. All times use timezone `Asia/Taipei`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Service discovery |
| `GET` | `/status` | Lock, L1, DLQ, dream status |
| `POST` | `/ingest` | Append L0 event + update L1 |
| `POST` | `/dream/run` | Extract patches → apply → clear L1 |
| `GET` | `/activate` | Activation packet (optional `?q=`) |

Full request/response schemas, error codes, and semantics: **[api.md](./api.md)**.

## Memory model (read-only context)

| Layer | Role |
|-------|------|
| **L0** | Append-only event log (`log/events.jsonl`) |
| **L1** | Short-term memory until next dream (`short-term-memory/`) |
| **L0.5** | Extracted patches (`dream/patches.jsonl`) |
| **L2** | Long-term node understanding (`nodes/{id}/understand/what.md`) |
| **chain** | Day-level memory chain (`memory-chain/days/`) |
| **candidates** | Proposed nodes / low-confidence attribution (`candidates/`) |

**Single-thread rule:** ingest and dream cannot run concurrently. Dream holds a lock; ingest returns `409` while dream is running.

## What the API does *not* expose (prototype)

These require manual edits under `ENGRAM_HOME` (or future APIs):

- Approve `candidates/nodes.yaml` → create `nodes/{id}/`
- Review / settle `dream/dead-letter.jsonl`
- Reset store (use `bun run reset` in `server/`)

Clients and skills should **not** write memory files directly; use the HTTP API for all operational changes.

## Related docs

- Server README: [../server/README.md](../server/README.md)
- Prototype design: [../roadmap/mvp/docs/prototype.md](../roadmap/mvp/docs/prototype.md)
