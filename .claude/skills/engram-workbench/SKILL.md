---
name: engram-workbench
description: Operate Engram memory via its HTTP API — capture events, run dream extract, review pending, approve/discard/retry/cancel, memory search/ask, check status. Use whenever the user mentions Engram, memory capture, dream run, memory search, L1/L2, candidates, or wants to read or write Engram state. Always call the API; never edit files under ENGRAM_HOME or data/ directly.
---

# Engram Workbench

Control-plane skill for **Engram** (Bun HTTP API at `ENGRAM_URL`).

**You call the API.** You do **not** read or write `data/`, `ENGRAM_HOME`, yaml/md memory files, or `server/` store paths for operational changes.

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |
| `ENGRAM_HOME` | (server-side only) do not touch from this skill |

Before any operation, confirm the server is up:

```bash
curl -s "${ENGRAM_URL:-http://localhost:8787}/status"
```

If connection refused → tell the user to run `cd server && bun run start` (and `bun run reset` only if they explicitly want an empty store).

**API doc:** [../../../api-docs/api.md](../../../api-docs/api.md)

**Helper:** `scripts/engram-api.sh` — thin curl wrapper for common calls.

## Boundaries

| Do | Don't |
|----|-------|
| `curl` / `engram-api.sh` against `ENGRAM_URL` | Edit `data/**`, `memory/nodes/**`, `dream/**` |
| `POST /capture` to capture | Append to `events.jsonl` by hand |
| `POST /dream/run` → pending → `approve`／`discard`／`retry`／`cancel` | Hand-edit L1／L2／draft during review |
| `GET /memory/l1` / `GET /memory/search` / `POST /memory/ask` | Assemble context by reading markdown files |
| `GET /future-sight` for near-horizon anchors | Hand-edit `future-sight/` |
| Report `dream_status` from `/status` | Manually fix DLQ via filesystem |

### Not exposed by API (prototype)

- Settle `dead-letter.jsonl`
- Node merge／fusion
- Wipe store → `cd server && bun run reset` (destructive; confirm first)

## Domain language

| Term | Meaning |
|------|---------|
| **Capture** | `POST /capture` — L0 + L1 pool entry |
| **Extract / Dream** | `POST /dream/run` — patches + draft + report; **does not** write L2；pending 時 409 |
| **Approve** | `POST /dream/approve` — `commitDraft` → L2, clear scope S |
| **Discard** | `POST /dream/discard` — drop pending; L1／L2 unchanged |
| **Retry** | `POST /dream/retry` `{ reason }` — discard → same frozen scope + feedback → new pending |
| **Dream cancel** | `POST /dream/cancel` — stop running extract; revert draft |
| **Memory / Search** | `GET /memory/search?q=&scope=` — keyword hits (`scope=l1,nodes,chain`) |
| **Ask** | `POST /memory/ask` — async AI Q&A; poll `GET /memory/ask/{job_id}` |
| **Future-sight** | `GET /future-sight` — active near-horizon anchors (sweeps expired → L0+L1 event) |
| **dream_status** | `ok` \| `pending_review` \| `l1_clear_pending` \| `dream_incomplete` \| `dead_letter_pending` \| `never_dreamed` |

## ⚠️ Before any API call

**Never guess field names.**

| Endpoint | Required field | Returns |
|----------|---------------|---------|
| `POST /capture` | `raw` (not `content`／`text`) | `event_id` |
| `POST /dream/run` | none | `202` + `job_id` — poll `/status`；pending 時 `409 pending_review` |
| `POST /dream/retry` | `{ reason }` required | `202` + `job_id` — same scope + review feedback |
| `GET /dream/pending` | none | always `200`; `present: false` if none |
| `POST /dream/approve` | body optional | committed paths + cleared_scope |
| `POST /dream/discard` | body optional | `{ discarded: true }` |
| `POST /dream/cancel` | body optional | cancel running dream |
| `GET /memory/l1` | none | `summary`, `node_notes`, `present` |
| `GET /memory/search` | `q` (required); `scope` optional | keyword hits per scope |
| `POST /memory/ask` | `q` | `202` + `job_id` |
| `GET /future-sight` | none | `anchors`, `swept_expired` |
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
./.claude/skills/engram-workbench/scripts/engram-api.sh memory-search acme nodes,chain
./.claude/skills/engram-workbench/scripts/engram-api.sh memory-ask 'What about Acme?'
./.claude/skills/engram-workbench/scripts/engram-api.sh future-sight
```

## Decision guide

| User intent | Action |
|-------------|--------|
| "記一下…" | `POST /capture` |
| "整理記憶"／extract | `POST /dream/run`；poll 至 `pending_review` |
| "看看夢報告" | `GET /dream/pending` |
| "批准"／寫入長期 | `POST /dream/approve` |
| "取消入夢" | `POST /dream/cancel` (running only) |
| "搜尋記憶" | `GET /memory/search?q=…&scope=…` |
| "問記憶庫" | `POST /memory/ask`；poll job |
| "近期前瞻／未來視" | `GET /future-sight`（過期會 mark event 後清掉） |
| "丟掉這次夢" | `POST /dream/discard` |
| "重試／改方向" | `POST /dream/retry` + `{ reason }` — **不要**手改檔案；**不要**無理由再 `dream/run` |
| pending 期間還要記 | 直接 capture（允許） |
| `l1_clear_pending` | 再 `approve`（只清 S） |
| extract 失敗 | L1 保留；可重試 `/dream/run`（無 pending 時） |

## Sub-files

- [workflows.md](workflows.md)
- [api-reference.md](api-reference.md)
