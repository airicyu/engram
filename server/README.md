# Engram Server (Prototype)

Bun HTTP API for Engram MVP memory: ingest → dream (extract+apply) → activate.

## Real trial (empty store)

```bash
cd server
bun install
bun run reset          # wipe ENGRAM_HOME → empty tree, no nodes
bun run start          # uses Cursor CLI (`agent`) by default
```

Then ingest your own text:

```bash
curl -s -X POST http://localhost:8787/ingest \
  -H 'content-type: application/json' \
  -d '{"raw":"今天和同事討論了…","source":"api"}'

curl -s http://localhost:8787/status
curl -s 'http://localhost:8787/activate'
curl -s -X POST http://localhost:8787/dream/run
```

> **不要**對試用庫跑 `fixture:apply --seed`——那會寫入 acme/alice/aurora 測試 node。  
> Fixture 只給機械層自測用。

Env:

| Var | Default | Meaning |
|-----|---------|---------|
| `ENGRAM_HOME` | `../data` | memory store root |
| `PORT` | `8787` | HTTP port |
| `CLAUDE_BIN` | `claude` | Claude Code binary (when `ENGRAM_AGENT=claude`) |
| `CURSOR_AGENT_BIN` | `agent` | Cursor CLI binary (when `ENGRAM_AGENT=cursor`) |
| `ENGRAM_AGENT` | `cursor` | `cursor` \| `claude` \| `mock-ok` \| `mock-fail`（後兩者僅測試） |
| `ENGRAM_DREAM_DEBUG` | (off) | `1` = verbose dream extract/apply logs (agent stdout preview, per-patch) |

## API

| Method | Path | |
|--------|------|--|
| `POST` | `/ingest` | `{ "raw", "source?", "node_refs?" }` → `{ event_id }` |
| `POST` | `/dream/run` | extract → apply → clear L1 |
| `GET` | `/activate?q=` | activation packet |
| `GET` | `/status` | lock, L1, DLQ, dream_status |

## Reset

```bash
bun run reset
# or another home:
ENGRAM_HOME=/tmp/engram-try bun run reset
```

## Fixture apply（僅 Phase 1 機械測試，勿當試用資料）

```bash
bun run reset
bun run fixture:apply -- fixtures/happy.jsonl --seed
bun run fixture:apply -- fixtures/with-bad.jsonl
```

## Self-test

```bash
bun run test:phases
```
