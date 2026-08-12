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
| `curl` / `engram-api.sh` against `ENGRAM_URL` | Edit `data/**`, `memories/nodes/**`, `dreams/**` |
| `POST /attachments/uploads` to upload images | Hand-place files under `_attachments/` |
| `POST /activities` to capture | Append to `events.jsonl` by hand |
| `POST /dreams/run` → pending → `approve`／`discard`／`retry`／`amend`／`cancel` | Hand-edit short-term／L2／draft during review |
| `GET /memories/short-term-memory` / `GET /memories/search` / `POST /memories/ask` | Assemble context by reading markdown files |
| `GET /memories/future-sight` for near-horizon anchors | Hand-edit `future-sight/` |
| Clarify: list／submit／dismiss／aside | Hand-edit `memories/clarify/` |
| Report `dream_status` from `/status` | Hand-edit dream state files |

### Not exposed by API (prototype)

- Node merge／fusion
- Wipe store → `cd server && bun run reset` (destructive; confirm first)

## Domain language

| Term | Meaning |
|------|---------|
| **Capture** | `POST /activities` — L0 + short-term pool entry |
| **Extract / Dream** | `POST /dreams/run` — AI 改 draft＋寫 report；**不**寫 L2。Pending → `409 pending_review`。短記空但有 closed higher catch-up → **rollup-only 202**；空且無事可做 → `409 nothing_to_dream` |
| **Approve** | `POST /dreams/approve` — deploy draft→live＋git commit → clear scope S |
| **Discard** | `POST /dreams/discard` — drop pending；short-term／L2 不變 |
| **Retry** | `POST /dreams/retry` `{ reason }` — discard → same frozen scope + feedback → new pending |
| **Amend** | `POST /dreams/amend` `{ instruction }` — same `dream_run_id` minimal draft edit; failure keeps pending |
| **Dream cancel** | `POST /dreams/cancel` — stop running dream；revert draft |
| **Memory / Search** | `GET /memories/search?q=&scope=` — keyword hits (`scope=l1,nodes,chain,future`; default all four; `future`＝hot＋later) |
| **Ask** | `POST /memories/ask` `{ q, include_later? }` — async AI Q&A（預設可讀 hot；`include_later:true` 才讀 later）；poll `GET /memories/ask/{job_id}` |
| **Future-sight** | `GET /memories/future-sight` — `hot`／`later` 錨點（GET 只清過期並可 git commit；重桶在入夢前） |
| **Clarify** | `GET /memories/clarify/asking`；`POST .../submit` `{ answer }`；`DELETE .../{id}`；`POST /memories/clarify/aside` `{ raw }` — 非 activity；dream lock → 409；pending_review 可寫 |
| **dream_status** | `ok` \| `pending_review` \| `l1_clear_pending` \| `dream_incomplete` \| `never_dreamed` |
| **store_git** | `GET /status.store_git` — 記憶庫是否為可用 local git（0.16+；否則 server 拒啟） |
| **store_version** | `GET /status.store_version` — 記憶庫結構世代。**0.28+ boot** 要求 major.minor ≥ 0.28，否則拒啟並須**離線**跑 engram-migration（`migrate-0.19-to-0.28`；無需先 start server；會丟棄未批准 dream）；對照 `product_version`（不必字串相等） |
| **Obsidian** | 人應開啟 `{ENGRAM_STORE_DIR}/memories/` 作為 vault（不是 store 根）。Node 主檔＝`nodes/{id}/{id}.md` |

## ⚠️ Before any API call

**Never guess field names.**

| Endpoint | Required field | Returns |
|----------|---------------|---------|
| `POST /activities` | `raw` (not `content`／`text`) | `event_id` |
| `POST /attachments/uploads` | multipart `file` (image/png, jpeg, webp, gif) | `201` + `{ path, day, filename }` |
| `GET /attachments/file` | query `path` | `200` image bytes |
| `DELETE /attachments/uploads/tmp` | query `day` + `filename` | `200` idempotent |
| `POST /attachments/housekeep` | none | `200` + `{ removed: string[] }` |
| `POST /dreams/run` | none | `202` + `job_id` — poll `/status`；pending → `409 pending_review`；空 pool＋catch-up → rollup-only 202；空且無事 → `409 nothing_to_dream` |
| `POST /dreams/retry` | `{ reason }` required | `202` + `job_id` — same scope + review feedback |
| `POST /dreams/amend` | `{ instruction }` required | `202` + `job_id`（＝pending id）— same draft；失敗仍可審 |
| `GET /dreams/pending` | none | always `200`; `present: false` if none；含 `node_score_involvements` |
| `PATCH /dreams/pending/node-score-involvements` | `{ id, category }` | 2a 改涉入 category（pending 時）；非法 category → 400；未知 id → 404 |
| `GET /dreams/events` | none | recent dream job log events（debug） |
| `POST /dreams/approve` | body optional | committed paths + cleared_scope；非 empty_patches 時結算 node score |
| `POST /dreams/discard` | body optional | `{ discarded: true }` |
| `POST /dreams/cancel` | body optional | cancel running dream |
| `GET /memories/short-term-memory` | none | short-term preview；wire 仍用 `l1`／`l1_empty` 等別名 |
| `GET /memories/search` | `q` (required); `scope` optional (`l1,nodes,chain,future`) | keyword hits per scope（`future`＝hot＋later） |
| `GET /memories/chain`／`weeks`／`months`／`years`（及 `/{id}`） | — | browse timeline |
| `GET /memories/nodes`／`{id}` | — | browse L2；含 `score`／`display_score`（無分 → null）；detail 回 `understanding` |
| `POST /memories/ask` | `q`; optional `include_later` (boolean) | `202` + `job_id` + `include_later` |
| `GET /memories/future-sight` | none | `anchors`（含 `zone`）、`swept_expired` |
| `GET /memories/clarify/asking` | none | `{ items: [...] }`（舊→新）；空＝`{ "items": [] }` |
| `POST /memories/clarify/asking/{id}/submit` | `{ answer }` | asking→pending；缺檔 404；lock → 409 |
| `DELETE /memories/clarify/asking/{id}` | none | dismiss；缺檔 200 冪等 |
| `POST /memories/clarify/aside` | `{ raw }` | **201** pending aside；非 L0 |
| `GET /clock` | none | `mode`, `now`, `today`, `allow_set` |
| `PUT /clock` | `now` **or** `day` (+ optional `time`) | needs `ENGRAM_ALLOW_VIRTUAL_CLOCK=1` |
| `DELETE /clock` | none | back to system clock |

## Quick operations

```bash
./scripts/engram-api.sh status
./scripts/engram-api.sh capture '今天討論了 API 設計'
./scripts/engram-api.sh attachment-upload ./photo.png
./scripts/engram-api.sh attachment-housekeep
./scripts/engram-api.sh dream
./scripts/engram-api.sh pending
./scripts/engram-api.sh approve
./scripts/engram-api.sh discard
./scripts/engram-api.sh dream-cancel
./scripts/engram-api.sh memory-l1
./scripts/engram-api.sh memory-search acme
./scripts/engram-api.sh memory-ask 'What about Acme?'
./scripts/engram-api.sh memory-ask 'When is launch?' true
./scripts/engram-api.sh future-sight
./scripts/engram-api.sh clarify-asking
./scripts/engram-api.sh clarify-aside '補充：合約其實兩年'
./scripts/engram-api.sh chain
./scripts/engram-api.sh nodes
```

（在 **本 skill 目錄**下執行；或把 `./scripts/engram-api.sh` 換成該檔的絕對／repo 相對路徑。）

## Decision guide

| User intent | Action |
|-------------|--------|
| "記一下…" | `POST /activities` |
| "記一下…（附圖）" | `POST /attachments/uploads` → 取得 `path` → `POST /activities`（含 `attachments[]`） |
| "刪 compose 暫存圖" | `DELETE /attachments/uploads/tmp?day=&filename=` |
| "清 tmp 上傳" | `POST /attachments/housekeep` |
| "整理記憶"／extract | `POST /dreams/run`；poll 至 `pending_review`（或 rollup-only／`nothing_to_dream`） |
| "空池還能入夢？" | 可：closed week／month／year catch-up → rollup-only 202；否則 `409 nothing_to_dream` |
| "看看夢報告" | `GET /dreams/pending` |
| "批准"／寫入長期 | `POST /dreams/approve` |
| "取消入夢" | `POST /dreams/cancel` (running only) |
| "搜尋記憶" | `GET /memories/search?q=…&scope=…`（預設含 `future`） |
| "翻時間軸／節點" | `GET /memories/chain`／`nodes`（及 higher／detail） |
| "問記憶庫" | `POST /memories/ask`（可選 `include_later`）；poll job |
| "近期前瞻／未來視" | `GET /memories/future-sight`；Seek Search／Ask 亦可讀（`scope=future`） |
| "釐清／補問／順帶補充" | `GET …/clarify/asking`；`POST …/submit` `{ answer }`；`DELETE …/{id}`；`POST …/aside` `{ raw }` |
| "丟掉這次夢" | `POST /dreams/discard` |
| "重試／改方向" | `POST /dreams/retry` + `{ reason }` — **不要**手改檔案；**不要**無理由再 `dreams/run` |
| "同稿小修／amend" | `POST /dreams/amend` + `{ instruction }` — 同一 `dream_run_id`；失敗仍 pending |
| pending 期間還要記 | 直接 capture／clarify（允許） |
| `l1_clear_pending` | 再 `approve`（只清 S） |
| extract 失敗 | short-term 保留；可重試 `/dreams/run`（無 pending 時） |

## External integrations

Building a **webhook, cron job, or other service** that only writes L0? Use [engram-activities-integration](../engram-activities-integration/SKILL.md) — not this skill.

## Sub-files

- [workflows.md](workflows.md)
- [api-reference.md](api-reference.md)
