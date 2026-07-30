---
name: engram-workbench
description: Operate Engram memory via its HTTP API — capture events, run dream extract, review pending, approve/discard/retry/cancel, memory search/ask, check status. Use whenever the user mentions Engram, memory capture, dream run, memory search, short-term/L2, candidates, or wants to read or write Engram state. Always call the API; never edit files under ENGRAM_STORE_DIR or data/ directly.
---

# Engram Workbench

Control-plane skill for **Engram** (Bun HTTP API at `ENGRAM_URL`).

**You call the API.** You do **not** read or write `data/`, `ENGRAM_STORE_DIR`, yaml/md memory files, or `server/` store paths for operational changes.

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |
| `ENGRAM_STORE_DIR` | (server-side only) do not touch from this skill |

Before any operation, confirm the server is up:

```bash
curl -s "${ENGRAM_URL:-http://localhost:8787}/status"
```

If connection refused → tell the user to run `cd server && bun run start` (and `bun run reset` only if they explicitly want an empty store).

**API doc:** [../../../docs/api-docs/api.md](../../../docs/api-docs/api.md)

**Helper:** `scripts/engram-api.sh` — thin curl wrapper for common calls.

## Boundaries

| Do | Don't |
|----|-------|
| `curl` / `engram-api.sh` against `ENGRAM_URL` | Edit `data/**`, `memories/nodes/**`, `dream/**` |
| `POST /activities` to capture | Append to `events.jsonl` by hand |
| `POST /dreams/run` → pending → `approve`／`discard`／`retry`／`cancel` | Hand-edit short-term／L2／draft during review |
| `GET /memories/short-term-memory` / `GET /memories/search` / `POST /memories/ask` | Assemble context by reading markdown files |
| `GET /memories/future-sight` for near-horizon anchors | Hand-edit `future-sight/` |
| Report `dream_status` from `/status` | Hand-edit dream state files |

### Not exposed by API (prototype)

- Node merge／fusion
- Wipe store → `cd server && bun run reset` (destructive; confirm first)

## Domain language

| Term | Meaning |
|------|---------|
| **Capture** | `POST /activities` — L0 + short-term pool entry |
| **Extract / Dream** | `POST /dreams/run` — AI 改 draft＋寫 report；**不**寫 L2；pending 時 409 |
| **Approve** | `POST /dreams/approve` — deploy draft→live＋git commit → clear scope S |
| **Discard** | `POST /dreams/discard` — drop pending；short-term／L2 不變 |
| **Retry** | `POST /dreams/retry` `{ reason }` — discard → same frozen scope + feedback → new pending |
| **Dream cancel** | `POST /dreams/cancel` — stop running dream；revert draft |
| **Memory / Search** | `GET /memories/search?q=&scope=` — keyword hits (`scope=l1,nodes,chain,future`; default all four; `future`＝hot＋later) |
| **Ask** | `POST /memories/ask` `{ q, include_later? }` — async AI Q&A（預設可讀 hot；`include_later:true` 才讀 later）；poll `GET /memories/ask/{job_id}` |
| **Future-sight** | `GET /memories/future-sight` — `hot`／`later` 錨點（GET 只清過期並可 git commit；重桶在入夢前） |
| **dream_status** | `ok` \| `pending_review` \| `l1_clear_pending` \| `dream_incomplete` \| `never_dreamed` |
| **store_git** | `GET /status.store_git` — 記憶庫是否為可用 local git（0.16+；否則 server 拒啟） |
| **store_version** | `GET /status.store_version` — 記憶庫結構世代（`engram.workspace.yaml`；缺鍵 → `null`）；對照 `product_version` |

## ⚠️ Before any API call

**Never guess field names.**

| Endpoint | Required field | Returns |
|----------|---------------|---------|
| `POST /activities` | `raw` (not `content`／`text`) | `event_id` |
| `POST /dreams/run` | none | `202` + `job_id` — poll `/status`；pending 時 `409 pending_review` |
| `POST /dreams/retry` | `{ reason }` required | `202` + `job_id` — same scope + review feedback |
| `GET /dreams/pending` | none | always `200`; `present: false` if none |
| `POST /dreams/approve` | body optional | committed paths + cleared_scope |
| `POST /dreams/discard` | body optional | `{ discarded: true }` |
| `POST /dreams/cancel` | body optional | cancel running dream |
| `GET /memories/short-term-memory` | none | `summary`, `node_notes`, `present` |
| `GET /memories/search` | `q` (required); `scope` optional (`l1,nodes,chain,future`) | keyword hits per scope |
| `POST /memories/ask` | `q`; optional `include_later` (boolean) | `202` + `job_id` + `include_later` |
| `GET /memories/future-sight` | none | `anchors`（含 `zone`）、`swept_expired` |
| `GET /clock` | none | `mode`, `now`, `today`, `allow_set` |
| `PUT /clock` | `now` **or** `day` (+ optional `time`) | needs `ENGRAM_ALLOW_VIRTUAL_CLOCK=1` |
| `DELETE /clock` | none | back to system clock |

## Quick operations

```bash
./.claude/skills/engram-workbench/scripts/engram-api.sh status
./.claude/skills/engram-workbench/scripts/engram-api.sh capture '今天討論了 API 設計'
./.claude/skills/engram-workbench/scripts/engram-api.sh dream
./.claude/skills/engram-workbench/scripts/engram-api.sh pending
./.claude/skills/engram-workbench/scripts/engram-api.sh approve
./.claude/skills/engram-workbench/scripts/engram-api.sh discard
./.claude/skills/engram-workbench/scripts/engram-api.sh dream-cancel
./.claude/skills/engram-workbench/scripts/engram-api.sh memory-l1
./.claude/skills/engram-workbench/scripts/engram-api.sh memory-search acme
./.claude/skills/engram-workbench/scripts/engram-api.sh memory-ask 'What about Acme?'
./.claude/skills/engram-workbench/scripts/engram-api.sh memory-ask 'When is launch?' true
./.claude/skills/engram-workbench/scripts/engram-api.sh future-sight
```

## Decision guide

| User intent | Action |
|-------------|--------|
| "記一下…" | `POST /activities` |
| "整理記憶"／extract | `POST /dreams/run`；poll 至 `pending_review` |
| "看看夢報告" | `GET /dreams/pending` |
| "批准"／寫入長期 | `POST /dreams/approve` |
| "取消入夢" | `POST /dreams/cancel` (running only) |
| "搜尋記憶" | `GET /memories/search?q=…&scope=…`（預設含 `future`） |
| "問記憶庫" | `POST /memories/ask`（可選 `include_later`）；poll job |
| "近期前瞻／未來視" | `GET /memories/future-sight`（過期清掉；discard 不回滾入夢前維護 commit）；Seek Search／Ask 亦可讀 |
| "丟掉這次夢" | `POST /dreams/discard` |
| "重試／改方向" | `POST /dreams/retry` + `{ reason }` — **不要**手改檔案；**不要**無理由再 `dream/run` |
| pending 期間還要記 | 直接 capture（允許） |
| `l1_clear_pending` | 再 `approve`（只清 S） |
| extract 失敗 | short-term 保留；可重試 `/dreams/run`（無 pending 時） |

## Sub-files

- [workflows.md](workflows.md)
- [api-reference.md](api-reference.md)
