---
name: engram-workbench
description: Operate Engram memory via its HTTP API — capture events, run dream extract, review pending, approve/discard, check status, recall context packets. Use whenever the user mentions Engram, memory capture, dream run, recall, L1/L2, candidates, or wants to read or write Engram state. Always call the API; never edit files under ENGRAM_HOME or data/ directly.
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
| `curl` / `engram-api.sh` against `ENGRAM_URL` | Edit `data/**`, `nodes/**`, `candidates/**`, `dream/**` |
| `POST /capture` to capture | Append to `events.jsonl` by hand |
| `POST /dream/run` → pending → `approve`／`discard` | Hand-edit L1／L2／draft during review |
| `GET /recall` to read context (Recall) | Assemble context by reading markdown files |
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
| **Extract / Dream** | `POST /dream/run` — patches + draft + report; **does not** write L2 |
| **Approve** | `POST /dream/approve` — `commitDraft` → L2, clear scope S |
| **Discard** | `POST /dream/discard` — drop pending; L1／L2 unchanged |
| **Recall** | `GET /recall` — L1, day chain, matched L2 (**no** future-sight in 0.4) |
| **Future-sight** | `GET /future-sight` — active near-horizon anchors (sweeps expired → L0+L1 event) |
| **dream_status** | `ok` \| `pending_review` \| `l1_clear_pending` \| `dream_incomplete` \| `dead_letter_pending` \| `never_dreamed` |

## ⚠️ Before any API call

**Never guess field names.**

| Endpoint | Required field | Returns |
|----------|---------------|---------|
| `POST /capture` | `raw` (not `content`／`text`) | `event_id` |
| `POST /dream/run` | none | `202` + `job_id` — poll `/status` |
| `GET /dream/pending` | none | always `200`; `present: false` if none |
| `POST /dream/approve` | body optional | committed paths + cleared_scope |
| `POST /dream/discard` | body optional | `{ discarded: true }` |
| `GET /recall` | `q` optional | `l1`, `chain`, `nodes` |
| `GET /future-sight` | none | `anchors`, `swept_expired` |

## Quick operations

```bash
./.claude/skills/engram-workbench/scripts/engram-api.sh status
./.claude/skills/engram-workbench/scripts/engram-api.sh capture '今天討論了 API 設計'
./.claude/skills/engram-workbench/scripts/engram-api.sh dream
./.claude/skills/engram-workbench/scripts/engram-api.sh pending
./.claude/skills/engram-workbench/scripts/engram-api.sh approve
./.claude/skills/engram-workbench/scripts/engram-api.sh discard
./.claude/skills/engram-workbench/scripts/engram-api.sh recall alice
./.claude/skills/engram-workbench/scripts/engram-api.sh future-sight
```

## Decision guide

| User intent | Action |
|-------------|--------|
| "記一下…" | `POST /capture` |
| "整理記憶"／extract | `POST /dream/run`；poll 至 `pending_review` |
| "看看夢報告" | `GET /dream/pending` |
| "批准"／寫入長期 | `POST /dream/approve` |
| "近期前瞻／未來視" | `GET /future-sight`（過期會 mark event 後清掉） |
| "丟掉這次夢" | `POST /dream/discard` |
| "重夢／改時間線" | 再 `POST /dream/run`（supersede）— **不要**手改檔案 |
| pending 期間還要記 | 直接 capture（允許） |
| `l1_clear_pending` | 再 `approve`（只清 S） |
| extract 失敗 | L1 保留；可重試 `/dream/run` |

## Sub-files

- [workflows.md](workflows.md)
- [api-reference.md](api-reference.md)
