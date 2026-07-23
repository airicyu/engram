# Engram Server (Prototype)

Bun HTTP API for Engram MVP memory: capture → dream (extract+apply) → memory.

## Real trial (empty store)

```bash
cd server
bun install
bun run reset          # wipe ENGRAM_HOME → empty tree, no nodes
bun run start          # uses Cursor CLI (`agent`) by default
```

Then capture your own text:

```bash
curl -s -X POST http://localhost:8787/capture \
  -H 'content-type: application/json' \
  -d '{"raw":"今天和同事討論了…","source":"api"}'

curl -s http://localhost:8787/status
curl -s 'http://localhost:8787/memory/l1'
curl -s 'http://localhost:8787/memory/search?q=同事&scope=nodes,chain'
curl -s -X POST http://localhost:8787/dream/run
```

Env: copy [`.env.example`](./.env.example) → `.env`（Bun 會自動載入；皆可選）。

| Var | Default | Meaning |
|-----|---------|---------|
| `ENGRAM_HOME` | `../data` | memory store root |
| `ENGRAM_TZ` | `Asia/Hong_Kong` | IANA timezone for calendar days + event timestamps |
| `PORT` | `8787` | HTTP port |
| `CLAUDE_BIN` | `claude` | Claude Code binary (when `ENGRAM_AGENT=claude`) |
| `CURSOR_AGENT_BIN` | `agent` | Cursor CLI binary (when `ENGRAM_AGENT=cursor`) |
| `ENGRAM_AGENT` | `cursor` | `cursor` \| `claude` \| `mock-ok` \| `mock-fail` \| `mock-ask-ok` |
| `ENGRAM_DREAM_DEBUG` | (off) | `1` = verbose dream extract/apply logs (agent stdout preview, per-patch) |

## API

| Method | Path | |
|--------|------|--|
| `POST` | `/capture` | `{ "raw", "source?", "node_refs?" }` → `{ event_id }` |
| `POST` | `/dream/run` | extract → draft → pending_review |
| `POST` | `/dream/cancel` | cancel running dream |
| `GET` | `/memory/l1` | L1 preview (Capture) |
| `GET` | `/memory/search?q=&scope=` | keyword hits (`q` required) |
| `POST` | `/memory/ask` | async AI Q&A |
| `GET` | `/status` | lock, L1, DLQ, dream_status, ask_job |

Full contract: [../api-docs/api.md](../api-docs/api.md).

## Reset

```bash
bun run reset
# or another home:
ENGRAM_HOME=/tmp/engram-try bun run reset
```

## Self-test

```bash
bun run test:phases
```
