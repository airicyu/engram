# Engram Server (Prototype)

Bun HTTP API for Engram MVP memory: capture → dream (draft file pipeline) → approve (deploy + git) → memory.

## Prerequisites

| Dependency | Notes |
|------------|--------|
| **Bun** | Runtime |
| **Git** | Required on PATH — each `ENGRAM_STORE_DIR` is a local git repo (0.16+); server refuses to start without it |
| **Agent CLI** | Claude Code (default); Cursor `agent` when `ENGRAM_AGENT=cursor`; Codex `codex` when `ENGRAM_AGENT=codex` |

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

**Obsidian（0.28+）：** 若用 Obsidian 閱讀記憶庫，請開啟 `{ENGRAM_STORE_DIR}/memories/` 作為 vault（不要開 store 根；`dreams/` 是暫存審稿區）。Node 主檔為 `nodes/{id}/{id}.md`。

**0.21+：** 除 `ENGRAM_STORE_DIR` 外，下表變數皆可改寫在 `{ENGRAM_STORE_DIR}/engram.workspace.yaml`（workspace 鍵優先）。完整對照見 [docs/configurations.md](../docs/configurations.md)。

| Var | Default | Meaning |
|-----|---------|---------|
| `ENGRAM_STORE_DIR` | `../data` | memory store root（**僅 env**） |
| `ENGRAM_TEMP_DIR` / `temp_dir` | `/tmp` | host temp for ask jobs + dream agent workdirs (outside store) |
| `ENGRAM_TZ` / `timezone` | `Asia/Hong_Kong` | IANA timezone |
| `ENGRAM_MEMORY_LANGUAGE` / `memory_language` | `en` | `zh-Hant` \| `zh-Hans` \| `en` |
| `PORT` / `port` | `8787` | HTTP port（**固定綁 `127.0.0.1`**，僅本機；`http://localhost:8787` 可用） |
| `CLAUDE_BIN` / `claude_bin` | `claude` | Claude Code binary (when agent=claude) |
| `CURSOR_AGENT_BIN` / `cursor_agent_bin` | `agent` | Cursor CLI binary (when agent=cursor) |
| `ENGRAM_CURSOR_SANDBOX` / `cursor_sandbox` | `disabled` | Cursor `--sandbox`：`disabled`（預設）｜`enabled` |
| `CODEX_BIN` / `codex_bin` | `codex` | Codex CLI binary (when agent=codex) |
| `ENGRAM_AGENT` / `agent` | `claude` | `claude` \| `cursor` \| `codex` \| `mock-ok` \| `mock-fail` \| `mock-ask-ok` |
| `ENGRAM_DREAM_DEBUG` / `dream_debug` | (off) | verbose dream extract/apply logs |
| `ENGRAM_ALLOW_VIRTUAL_CLOCK` / `allow_virtual_clock` | (off) | allow `PUT /clock` (time replay) |

## API

| Method | Path | |
|--------|------|--|
| `POST` | `/activities` | `{ "raw", "source?", "attachments?" }`（`raw` 可含 mention token；**勿**傳 `node_refs`）→ `{ event_id }` |
| `POST` | `/dreams/run` | AI edits draft＋report → pending_review（pending 時 409） |
| `POST` | `/dreams/retry` | discard pending → same scope + reason → new pending |
| `POST` | `/dreams/cancel` | cancel running dream |
| `POST` | `/dreams/approve` | deploy＋git commit → L2；clear scope S |
| `GET` | `/memories/short-term-memory` | short-term preview (Activities) |
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
| `GET` | `/status` | lock, short-term (`l1_empty`), dream_status, ask_job, clock |

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
