# Engram Server (Prototype)

Bun HTTP API for Engram MVP memory: capture → dream (extract+apply) → recall.

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
curl -s 'http://localhost:8787/recall'
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
| `ENGRAM_AGENT` | `cursor` | `cursor` \| `claude` \| `mock-ok` \| `mock-fail`（後兩者僅測試） |
| `ENGRAM_DREAM_DEBUG` | (off) | `1` = verbose dream extract/apply logs (agent stdout preview, per-patch) |

## API

| Method | Path | |
|--------|------|--|
| `POST` | `/capture` | `{ "raw", "source?", "node_refs?" }` → `{ event_id }` |
| `POST` | `/dream/run` | extract → apply → clear L1 |
| `GET` | `/recall?q=` | recall packet |
| `GET` | `/status` | lock, L1, DLQ, dream_status |

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
