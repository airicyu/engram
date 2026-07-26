# Engram Server (Prototype)

Bun HTTP API for Engram MVP memory: capture → dream (extract+apply) → memory.

## Real trial (empty store)

```bash
cd server
bun install
bun run reset          # wipe ENGRAM_STORE_DIR → empty tree, no nodes
bun run start          # uses Cursor CLI (`agent`) by default
```

Then capture your own text:

```bash
curl -s -X POST http://localhost:8787/activities \
  -H 'content-type: application/json' \
  -d '{"raw":"今天和同事討論了…","source":"api"}'

curl -s http://localhost:8787/status
curl -s 'http://localhost:8787/memories/short-term-memory'
curl -s 'http://localhost:8787/memories/search?q=同事&scope=nodes,chain'
curl -s 'http://localhost:8787/memories/chain'
curl -s 'http://localhost:8787/memories/nodes'
curl -s -X POST http://localhost:8787/dreams/run
```

Env: copy [`.env.example`](./.env.example) → `.env`（Bun 會自動載入；皆可選）。首次也可用 repo 根目錄 `bun run setup`。

| Var | Default | Meaning |
|-----|---------|---------|
| `ENGRAM_STORE_DIR` | `../data` | memory store root |
| `ENGRAM_TZ` | `Asia/Hong_Kong` | IANA timezone (overridden by `{ENGRAM_STORE_DIR}/engram.workspace.yaml` `timezone`) |
| `ENGRAM_MEMORY_LANGUAGE` | `en` | `zh-Hant` \| `zh-Hans` \| `en` when workspace omits `memory_language` |
| `PORT` | `8787` | HTTP port（**固定綁 `127.0.0.1`**，僅本機；`http://localhost:8787` 可用） |
| `CLAUDE_BIN` | `claude` | Claude Code binary (when `ENGRAM_AGENT=claude`) |
| `CURSOR_AGENT_BIN` | `agent` | Cursor CLI binary (when `ENGRAM_AGENT=cursor`) |
| `ENGRAM_AGENT` | `cursor` | `cursor` \| `claude` \| `mock-ok` \| `mock-fail` \| `mock-ask-ok` |
| `ENGRAM_DREAM_DEBUG` | (off) | `1` = verbose dream extract/apply logs (agent stdout preview, per-patch) |
| `ENGRAM_ALLOW_VIRTUAL_CLOCK` | (off) | `1` = allow `PUT /clock` (time replay) |

## API

| Method | Path | |
|--------|------|--|
| `POST` | `/activities` | `{ "raw", "source?", "node_refs?" }` → `{ event_id }` |
| `POST` | `/dreams/run` | extract → draft → pending_review（pending 時 409） |
| `POST` | `/dreams/retry` | discard pending → same scope + reason → new pending |
| `POST` | `/dreams/cancel` | cancel running dream |
| `GET` | `/memories/short-term-memory` | L1 preview (Capture) |
| `GET` | `/memories/search?q=&scope=` | keyword hits (`q` required) |
| `GET` | `/memories/chain` | day chain index (browse) |
| `GET` | `/memories/chain/{day_id}` | day chain detail |
| `GET` | `/memories/chain/weeks` | week index |
| `GET` | `/memories/chain/weeks/{week_id}` | week detail |
| `GET` | `/memories/chain/months` | month index |
| `GET` | `/memories/chain/months/{month_id}` | month detail |
| `GET` | `/memories/chain/years` | year index |
| `GET` | `/memories/chain/years/{year_id}` | year detail |
| `GET` | `/memories/nodes` | L2 node index (browse) |
| `GET` | `/memories/nodes/{node_id}` | L2 node detail |
| `POST` | `/memories/ask` | async AI Q&A |
| `GET`/`PUT`/`DELETE` | `/clock` | virtual memory timeline (PUT needs env) |
| `GET` | `/status` | lock, L1, DLQ, dream_status, ask_job, clock |

Full contract: [../docs/api-docs/api.md](../docs/api-docs/api.md).

## Time replay

```bash
# Dedicated store + allow virtual clock
ENGRAM_STORE_DIR=/tmp/engram-replay ENGRAM_ALLOW_VIRTUAL_CLOCK=1 bun run reset
ENGRAM_STORE_DIR=/tmp/engram-replay ENGRAM_ALLOW_VIRTUAL_CLOCK=1 ENGRAM_AGENT=mock-ok bun run start
# other terminal:
bun run replay -- --fixture=fixtures/replay-sample.jsonl
```

## Reset

```bash
bun run reset
# or another home:
ENGRAM_STORE_DIR=/tmp/engram-try bun run reset
```

## Chain backfill

```bash
# Build week／month／year summaries from existing day summaries (engineering)
ENGRAM_STORE_DIR=/path/to/store ENGRAM_AGENT=mock-ok bun run chain:backfill -- --level=all
# or: --level=month --until=2026-07
```

## Self-test

```bash
bun run test:phases
```
