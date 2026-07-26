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
curl -s 'http://localhost:8787/memory/chain'
curl -s 'http://localhost:8787/memory/nodes'
curl -s -X POST http://localhost:8787/dream/run
```

Env: copy [`.env.example`](./.env.example) → `.env`（Bun 會自動載入；皆可選）。首次也可用 repo 根目錄 `bun run setup`。

| Var | Default | Meaning |
|-----|---------|---------|
| `ENGRAM_HOME` | `../data` | memory store root |
| `ENGRAM_TZ` | `Asia/Hong_Kong` | IANA timezone (overridden by `{ENGRAM_HOME}/engram.workspace.yaml` `timezone`) |
| `ENGRAM_MEMORY_LANGUAGE` | `en` | `zh-Hant` \| `zh-Hans` \| `en` when workspace omits `memory_language` |
| `PORT` | `8787` | HTTP port |
| `CLAUDE_BIN` | `claude` | Claude Code binary (when `ENGRAM_AGENT=claude`) |
| `CURSOR_AGENT_BIN` | `agent` | Cursor CLI binary (when `ENGRAM_AGENT=cursor`) |
| `ENGRAM_AGENT` | `cursor` | `cursor` \| `claude` \| `mock-ok` \| `mock-fail` \| `mock-ask-ok` |
| `ENGRAM_DREAM_DEBUG` | (off) | `1` = verbose dream extract/apply logs (agent stdout preview, per-patch) |
| `ENGRAM_ALLOW_VIRTUAL_CLOCK` | (off) | `1` = allow `PUT /clock` (time replay) |

## API

| Method | Path | |
|--------|------|--|
| `POST` | `/capture` | `{ "raw", "source?", "node_refs?" }` → `{ event_id }` |
| `POST` | `/dream/run` | extract → draft → pending_review（pending 時 409） |
| `POST` | `/dream/retry` | discard pending → same scope + reason → new pending |
| `POST` | `/dream/cancel` | cancel running dream |
| `GET` | `/memory/l1` | L1 preview (Capture) |
| `GET` | `/memory/search?q=&scope=` | keyword hits (`q` required) |
| `GET` | `/memory/chain` | day chain index (browse) |
| `GET` | `/memory/chain/{day_id}` | day chain detail |
| `GET` | `/memory/chain/weeks` | week index |
| `GET` | `/memory/chain/weeks/{week_id}` | week detail |
| `GET` | `/memory/chain/months` | month index |
| `GET` | `/memory/chain/months/{month_id}` | month detail |
| `GET` | `/memory/chain/years` | year index |
| `GET` | `/memory/chain/years/{year_id}` | year detail |
| `GET` | `/memory/nodes` | L2 node index (browse) |
| `GET` | `/memory/nodes/{node_id}` | L2 node detail |
| `POST` | `/memory/ask` | async AI Q&A |
| `GET`/`PUT`/`DELETE` | `/clock` | virtual memory timeline (PUT needs env) |
| `GET` | `/status` | lock, L1, DLQ, dream_status, ask_job, clock |

Full contract: [../api-docs/api.md](../api-docs/api.md).

## Time replay

```bash
# Dedicated store + allow virtual clock
ENGRAM_HOME=/tmp/engram-replay ENGRAM_ALLOW_VIRTUAL_CLOCK=1 bun run reset
ENGRAM_HOME=/tmp/engram-replay ENGRAM_ALLOW_VIRTUAL_CLOCK=1 ENGRAM_AGENT=mock-ok bun run start
# other terminal:
bun run replay -- --fixture=fixtures/replay-sample.jsonl
```

## Reset

```bash
bun run reset
# or another home:
ENGRAM_HOME=/tmp/engram-try bun run reset
```

## Chain layout migration / backfill

```bash
# Flat days/*.md → days/YYYY-MM/… (idempotent)
ENGRAM_HOME=/path/to/store bun run chain:migrate-days

# Build week／month／year summaries from existing day summaries (engineering)
ENGRAM_HOME=/path/to/store ENGRAM_AGENT=mock-ok bun run chain:backfill -- --level=all
# or: --level=month --until=2026-07
```

Pending drafts are not guaranteed compatible across day-layout migration — discard pending first.

## Self-test

```bash
bun run test:phases
```
