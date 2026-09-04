# Engram HTTP API Reference

Base URL: `http://localhost:8787` (override with `PORT`).

**CORS (browser):** Origins matching `http(s)://localhost|127.0.0.1|[::1]` with **any port** are allowed (reflected `Access-Control-Allow-Origin`). Non-local Origins are unchanged (no ACAO). `OPTIONS` preflight → `204`.

All timestamps and calendar dates use the **effective** IANA timezone: `{ENGRAM_STORE_DIR}/engram.workspace.yaml` `timezone` if set, else `ENGRAM_TZ`, else **`Asia/Hong_Kong`**.

**Memory write language** (`memory_language`): workspace yaml → `ENGRAM_MEMORY_LANGUAGE` → **`en`**. Allowed values only: `zh-Hant`｜`zh-Hans`｜`en`. Controls language of **new** dream／rollup／ask prose (not L0 `raw`, not workbench UI i18n).  

**Store structure version** (`store_version`): semver in the same workspace yaml（例 `0.40.0`）. **Boot gate (0.40+):** after `ensureEngramHome`, disk `store_version` major.minor must be **≥ 0.40**; missing key or older structure → **server refuses to start** with an **offline** migrate hint（**engram-migration** skill：`0.36.x–0.39.x` → `migrate-0.36-to-0.40`；`0.28.x–0.35.x` → `migrate-0.28-to-0.36`；`0.19.x–0.27.x` 須先 `migrate-0.19-to-0.28` — from that skill directory run the matching `bun ./scripts/….ts`; **server need not be running first**; 0.19→0.28 discards unapproved pending dreams）. Does **not** require `store_version === product_version`（same structure generation may stamp newer product strings）. Escape hatch: `ENGRAM_ALLOW_STALE_STORE=1`（warns, still starts）. Present but not `X.Y.Z` → **server refuses to start**（workspace parse）. Server never auto-rewrites an existing／missing value to the product version on boot（except creating a brand-new workspace file）.


Invalid workspace yaml／unknown keys／illegal values → **server refuses to start**.

First-run bootstrap: repo root `bun run setup` (wizard under `setup-wizard/`).

When a **virtual clock** is set (`PUT /clock`, requires `ENGRAM_ALLOW_VIRTUAL_CLOCK=1`), capture timestamps, dream “today” gates, and agent `today`/`now` follow that timeline instead of the wall clock. See [Virtual clock](#virtual-clock).

**Empty reads:** endpoints that mean “no content right now” return **200** with an empty body shape (`present: false`, `null`, `[]`) — **not 404**. 404 is only for unknown paths/methods.

---

## `GET /`

Service discovery.

**Response `200`**

```json
{
  "name": "engram",
  "endpoints": [
    "POST /activities",
    "POST /attachments/uploads",
    "GET /attachments/file",
    "DELETE /attachments/uploads/tmp",
    "POST /attachments/housekeep",
    "POST /dreams/run",
    "GET /dreams/pending",
    "GET /dreams/reports",
    "GET /dreams/reports/:id",
    "PATCH /dreams/pending/node-score-involvements",
    "GET /dreams/events",
    "POST /dreams/approve",
    "POST /dreams/discard",
    "POST /dreams/retry",
    "POST /dreams/amend",
    "GET /memories/future-sight",
    "GET /memories/short-term-memory",
    "GET /memories/search",
    "GET /memories/chain",
    "GET /memories/chain/weeks",
    "GET /memories/chain/weeks/{week_id}",
    "GET /memories/chain/months",
    "GET /memories/chain/months/{month_id}",
    "GET /memories/chain/years",
    "GET /memories/chain/years/{year_id}",
    "GET /memories/chain/{day_id}",
    "GET /memories/nodes",
    "GET /memories/nodes/graph",
    "GET /memories/nodes/{node_id}",
    "GET /memories/clarify/asking",
    "GET /memories/clarify/pending",
    "POST /memories/clarify/asking/{id}/submit",
    "DELETE /memories/clarify/asking/{id}",
    "POST /memories/clarify/aside",
    "POST /memories/ask",
    "GET /memories/ask/recent",
    "GET /memories/ask/{job_id}",
    "POST /memories/ask/{job_id}/cancel",
    "POST /dreams/cancel",
    "GET /clock",
    "PUT /clock",
    "DELETE /clock",
    "GET /status"
  ]
}
```

---

## `GET /status`

Snapshot of store health, dream state, and async job status.

**Response `200`**

```json
{
  "store_dir": "/path/to/data",
  "store_git": true,
  "store_version": "0.29.0",
  "product_version": "0.29.0",
  "temp_dir": "/tmp",
  "timezone": "Asia/Hong_Kong",
  "memory_language": "en",
  "clock": {
    "mode": "system",
    "now": "2026-07-24T23:00:00+08:00",
    "today": "2026-07-24",
    "timezone": "Asia/Hong_Kong",
    "allow_set": false
  },
  "lock": false,
  "l1_empty": false,
  "future_sight_active_count": 0,
  "future_sight_upcoming_count": 0,
  "future_sight_long_term_count": 0,
  "future_sight_window_days": 365,
  "future_sight_upcoming_days": 30,
  "dream_status": "pending_review",
  "dream_pending": {
    "dream_run_id": "dream-20260721-220000-a1b2c3",
    "scope_count": 2,
    "patch_count": 3
  },
  "l1_clear_pending": null,
  "dream_job": null,
  "ask_job": null,
  "dream_cleanup": null,
  "dream_scheduler": {
    "cleanup_cron": "0 3 * * *",
    "cleanup_cron_enabled": true,
    "cleanup_on_start": true,
    "staging_retention_days": 3,
    "committed_report_retention_days": 7,
    "cleanup_min_age_days": 1,
    "auto_dream_enabled": false,
    "auto_dream_cron": "30 3 * * *",
    "dream_auto_approve": true
  }
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `dream_cleanup` | object? | Present after startup sweep, cron, or `bun run dreams:cleanup`; last summary |
| `dream_scheduler` | object | Effective in-process scheduler settings (workspace → env → defaults) |
| `store_dir` | string | Resolved `ENGRAM_STORE_DIR` path |
| `store_git` | boolean | `true` when `ENGRAM_STORE_DIR` is a usable local git work tree (0.16+; server refuses to start otherwise) |
| `store_version` | string \| null | Disk **structure** generation from `engram.workspace.yaml` `store_version`（semver）. **0.36+ boot** requires major.minor **≥ 0.36** or the process exits before listen（unless `ENGRAM_ALLOW_STALE_STORE=1`）. Migrate offline via `migrate-0.28-to-0.36`（older than 0.28: `migrate-0.19-to-0.28` first）. Missing key → start failure（status is only reachable when gate passed, so typically a stamped string） |
| `product_version` | string | Engram product version from repo `version.md`（for comparison； mismatch does **not** refuse start） |
| `temp_dir` | string | Resolved `ENGRAM_TEMP_DIR` (default `/tmp`) — ask jobs + dream agent disposable workdirs |
| `timezone` | string | Effective IANA zone (workspace yaml → `ENGRAM_TZ` → `Asia/Hong_Kong`) |
| `memory_language` | string | Effective write language: `zh-Hant`｜`zh-Hans`｜`en` |
| `clock` | object | Memory-timeline clock snapshot (see [Virtual clock](#virtual-clock)) |
| `lock` | boolean | `true` while extract／materialize／approve commit holds the run mutex. **Does not** mean capture／upload／clarify writes are rejected. |
| `lock_stale` | boolean? | Present only when `lock: true`; stale lock (>30 min) |
| `l1_empty` | boolean | `true` when short-term memory pool has no entries |
| `future_sight_active_count` | number | Total items in `upcoming.md`＋`longTerm.md` (name kept for compatibility) |
| `future_sight_upcoming_count` | number | Items in `memories/future-sight/upcoming.md` |
| `future_sight_long_term_count` | number | Items in `memories/future-sight/longTerm.md` |
| `future_sight_window_days` | number | Effective admission window (workspace → env → **365**) |
| `future_sight_upcoming_days` | number | Effective upcoming zone days (workspace → env → 30) |
| `dream_status` | enum | See [Dream status](#dream-status) |
| `dream_pending` | object? | Active pending summary, or `null` |
| `l1_clear_pending` | object? | Commit succeeded but scope clear failed — retry approve |
| `dream_job` | object? | Last／current async extract job |
| `ask_job` | object? | Last／current async memory-ask job（`null` when none） |

**`dream_job` object:**

| Field | Meaning |
|-------|---------|
| `status` | `"running"` \| `"completed"` \| `"failed"` |
| `phase` | `"extract"` \| `"materialize"` \| `"pending_review"` \| `"ok"`（0.39：自動 approve 成功） |
| `log_tail` | When `status` is `"running"`: last ≤20 structured events (same shape as `GET /dreams/events`) |
| `result` | On success: `scope`, `patch_count`, `superseded` (always null since 0.12), `phase`；0.39 另有 `auto_approved`（boolean），失敗自動 approve 時可有 `auto_approve_error` |
| `error` | On failure |

---

## Virtual clock

Memory-timeline clock used by capture `ts`, dream “today” gates (chain／future-sight), and agent prompts. Wall-clock is still used for process concerns (lock staleness, timers).

### `GET /clock`

**Response `200`**

```json
{
  "mode": "system",
  "now": "2026-07-24T23:00:00+08:00",
  "today": "2026-07-24",
  "timezone": "Asia/Hong_Kong",
  "allow_set": false
}
```

| Field | Meaning |
|-------|---------|
| `mode` | `"system"` (wall) or `"virtual"` |
| `now` | Current memory-timeline ISO-8601 with offset |
| `today` | Calendar day `YYYY-MM-DD` in `timezone` |
| `allow_set` | `true` when `ENGRAM_ALLOW_VIRTUAL_CLOCK=1` |

### `PUT /clock`

Requires `ENGRAM_ALLOW_VIRTUAL_CLOCK=1`. Persists to `ENGRAM_STORE_DIR/tmp/clock.json` (ask jobs live under `ENGRAM_TEMP_DIR`, not the store).

**Body** — one of:

```json
{ "now": "2026-05-12T21:05:00+08:00" }
```

```json
{ "day": "2026-05-12", "time": "23:30:00" }
```

`time` optional (default `12:00:00`).

**Response `200`** — same shape as `GET /clock`, plus `set` (formatted ISO that was applied).

| Status | Error |
|--------|-------|
| `403` | `virtual_clock_disabled` |
| `400` | `invalid_body` / `invalid_datetime` |

### `DELETE /clock`

Clear virtual clock (always allowed). Returns system snapshot.

### Time replay (CLI)

Day-by-day fixture replay (not an HTTP endpoint):

```bash
# Server: ENGRAM_ALLOW_VIRTUAL_CLOCK=1, prefer dedicated ENGRAM_STORE_DIR + reset
cd server && bun run replay -- --fixture=fixtures/replay-sample.jsonl
# optional: --pause  --dream-at=22:00:00  --dream-next-day  --base-url=http://127.0.0.1:8787
```

Fixture JSONL lines: `{ "ts", "raw", "source?" }` — `ts` is encoding time. Legacy `node_refs` in fixtures is ignored. Orchestrator: set clock → capture → dream at night → approve → next day.

**Do not** pass client `ts` on `POST /activities`; set the clock first.

---

## `GET /dreams/events`

Incremental dream run event log for UI polling and post-mortem review.

**Query**

| Param | Required | Meaning |
|-------|----------|---------|
| `run_id` | yes | `dream_run_id` from `POST /dreams/run` or `/status` `dream_job` |
| `after` | no | 0-based event offset (default `0`) |

**Response `200`**

```json
{
  "run_id": "dream-20260723-210000-a1b2c3",
  "status": "running",
  "phase": "extract",
  "events": [
    {
      "ts": "2026-07-23T21:00:01+08:00",
      "level": "info",
      "phase": "extract",
      "event": "run_start",
      "message": "Dream run started (2 events in scope)"
    }
  ],
  "total": 5,
  "has_more": false
}
```

| `status` | `running` \| `completed` \| `failed` \| `unknown` |

**Errors:** `400` missing `run_id`. No file for run → `200` with `events: []`, `status: "unknown"`.

Events are stored at `dream/runs/{dream_run_id}/events.jsonl` (append-only). Superseded runs keep their logs.

---

## `POST /activities`

Append one event to L0 and the short-term memory pool (indexed by event id).

**Allowed during extract, deploy, and `pending_review`.** Capture waits on the capture lock (may delay) but still returns **201**, not `409 dream_locked`. New events are **not** in the running dream's frozen scope.

**Request body**

```json
{
  "raw": "Talked to [@alice](node:alice) about [@acme](node:acme) — optional mention tokens",
  "source": "api",
  "idempotency_key": "optional",
  "attachments": [
    {
      "path": "_attachments/uploads/2026-08-09/menu.png",
      "relationship": "Lunch menu photo"
    }
  ]
}
```

**Response `201`:** `{ "event_id": "e0000000001" }`

**Errors:** `400` missing `raw`；`400` `node_refs_removed`（請求體出現已廢除的 `node_refs` 鍵）；`400` `invalid_mention_id`／`mention_create_exists`（`raw` 內 mention token）；`400` `embed_without_attachment`／`attachment_not_in_embeds`／`empty_relationship`／`duplicate_attachment_path`／`invalid_attachment_path`／`attachment_file_missing`／`double_appendix`。**0.41：** extract／deploy 中 **不再** `409 dream_locked`。

**0.32+ mentions：** 關聯真相寫在 `raw` 內嵌 token——`[@label](node:{id})`（既有）／`[@label](node-create:{id})`（本輪應新建）。**禁止**再傳 `node_refs`（鍵存在即 400）。`node-create` 若 live 已有該 id → 400 `mention_create_exists`（不自動改成 ref）。舊 JSONL 若仍含 `node_refs`：讀取忽略，不做 migrate。Dream context 對每則 event 附解析後的 `mentions: [{ id, mode }]`；漏建 create → Structure notes 軟警告（不擋 approve）。

單次成功回應時 L0 與 short-term pool 一致反映該事件（0.20 capture 原子路徑）。

**0.29+ 附件：** `attachments` 可選；若有則需與 `raw` 內 `![[_attachments/uploads/…]]` embed 精確對稱（集合相等），不可含 `|alias` 變體。Server 會將 tmp 檔搬至正式目錄，並在 `raw` 末尾追加 `## Attachment relationships` appendix。Event 記錄含結構化 `attachments` 欄位與含 appendix 的最終 `raw`。

---

## `POST /attachments/uploads`

上傳圖檔至 tmp 暫存目錄。Multipart 欄位名 **`file`**。

**MIME 限制：** `image/jpeg`｜`image/png`｜`image/webp`｜`image/gif`（拒 HEIC 與其餘）。  
**大小限制：** 預設 10 MiB（`attachment_max_bytes` workspace／`ENGRAM_ATTACHMENT_MAX_BYTES`）。  
**Dream lock：** 上傳 **不**因 extract／deploy 回 `409 dream_locked`（0.41）。`DELETE …/uploads/tmp` 本來就不擋。

**Response `201`**

```json
{
  "path": "_attachments/uploads/2026-08-09/menu.png",
  "day": "2026-08-09",
  "filename": "menu.png"
}
```

**實體：** `memories/_attachments/uploads/tmp/{day}/{filename}`。  
`path` 為最終正式路徑（永不含 `/tmp`），可直接嵌入 `raw`。

**Errors:** `400` `missing_file`／`invalid_mime`／`file_too_large`／`invalid_filename`。

---

## `GET /attachments/file`

Serve an attachment file for preview (formal or tmp).

**Query:** `?path=_attachments/uploads/{day}/{filename}`

**Response `200`:** binary image with appropriate `Content-Type` header.  
**Errors:** `400` `missing_path`／`invalid_path`；`404` `not_found`.

---

## `DELETE /attachments/uploads/tmp`

刪除一筆 tmp 暫存圖檔。**冪等**（缺檔仍 200）。**不**刪正式 `uploads/{day}/`。

**Query:** `?day=YYYY-MM-DD&filename=name.ext`

**Response `200`:** `{ "deleted": true, "day": "…", "filename": "…" }`

**Errors:** `400` `missing_params`／`invalid_day`／`invalid_filename`。

---

## `POST /attachments/housekeep`

觸發 tmp 上傳目錄清理：依目錄名 `YYYY-MM-DD` 與有效時鐘的日差 ≥ retention 天數則移除該日 tmp 目錄。預設 retention **2** 天（`attachment_tmp_retention_days`／`ENGRAM_ATTACHMENT_TMP_RETENTION_DAYS`）。

**Response `200`:** `{ "removed": ["2026-08-07", "2026-08-06"] }`

---

## `POST /dreams/run`

Async **extract → materialize draft → unique pending**. Does **not** write L2 **until approve**.

**0.39 `dream_auto_approve`（預設 `true`）：** job 成功寫出 pending 後，server **立刻**走既有 approve（deploy＋git＋清 scope）。Poll `/status` 至 `dream_status=ok`（或清 scope 失敗時的 `l1_clear_pending`）。設 `false`（workspace／`ENGRAM_DREAM_AUTO_APPROVE=0`）則停在 `pending_review`，行為與 0.38 相同。自動 approve 失敗 → pending 留下，job 仍 `completed`，`result.auto_approved=false`。

- Pool **empty**：
  - 尚有「已結束、缺 higher、下層有內容」的 week／month／year → **202** rollup-only（跳過 day extract，只跑 cascade）
  - 無上述 catch-up → **409** `nothing_to_dream`
- Existing pending → **409** `pending_review`（禁止無理由取代；改用 `POST /dreams/retry`／`POST /dreams/amend` 或先 `discard`）
- Scope **S** = all event ids in the pool at call time（pool 空時 S＝`[]`）
- Extract input = L0 events for S (may span days) + short-term view for S + existing L2（rollup-only 跳過 extract）
- `job_id` / `dream_run_id` shape: `dream-YYYYMMDD-HHmmss-{rand6}` (ENGRAM_TZ local time)

**Response `202`**

```json
{
  "job_id": "dream-20260721-220000-a1b2c3",
  "status": "started",
  "message": "Dream extract+materialize submitted. Poll GET /status; on success dream_status becomes ok (auto-approve). …"
}
```

**Errors**

| Status | error | When |
|--------|-------|------|
| `409` | `nothing_to_dream` | short-term pool empty **且**無已結束缺檔的 higher chain 可關帳（0.24 起） |
| `409` | `pending_review` | Active pending exists — use retry／discard／approve |
| `409` | `dream_locked` | Another extract／commit in progress |

Rollup-only（pool 空＋有 catch-up）產生的 pending：`scope: []`；report Narrative 標明為 rollup-only；draft manifest 僅含 higher summaries。Approve／discard／retry 路徑不變。

On extract／materialize failure: `dream_job.status=failed` + `phase`; **no** pending; short-term unchanged.

---

## `POST /dreams/retry`

Async. Requires active **pending_review**. Body:

```json
{ "reason": "…", "dream_run_id": "…" }
```

- `reason` **required** (non-empty after trim) → else **400** `missing_reason`
- Optional `dream_run_id` — mismatch → **409** `dream_run_mismatch`

**Semantics**

1. Snapshot current pending: frozen **scope S**, draft／patches summary
2. **Discard** that pending (status `discarded`; draft removed; short-term／L2 unchanged)
3. Start new dream on **the same S** (not re-scan whole short-term memory pool)
4. Dream context includes `review_feedback`: `{ reason, previous_summary, previous_changes }`
5. New run metadata records `retried_from` + `retry_reason`; report notes the feedback
6. Completes to a new pending；若 `dream_auto_approve` 則隨即自動 approve（同 `/dreams/run`）

Consecutive retries: each uses the **just-discarded** attempt’s summary; **S stays the original event ids**; only the **current** reason is passed (not a history stack).

**Response `202`** — same shape as `POST /dreams/run`.

**Errors**

| Status | error | When |
|--------|-------|------|
| `400` | `missing_reason` | Missing／blank `reason` |
| `409` | `no_pending` | No pending dream |
| `409` | `dream_run_mismatch` | Body id ≠ active pending |
| `409` | `dream_locked` | Extract／commit in progress |

---

## `POST /dreams/amend`

Async. Requires active **pending_review**. Body:

```json
{ "instruction": "…", "dream_run_id": "…" }
```

- `instruction` **required** (non-empty after trim) → else **400** `missing_instruction`
- Optional `dream_run_id` — mismatch → **409** `dream_run_mismatch`

**Semantics（amend-dream；≠ re-dream／retry）**

1. Keep the **same** `dream_run_id` and frozen **scope S**
2. **Do not** discard pending; **do not** wipe／`prepareDreamDraft`
3. Spawn amend agent with `amend-dream.md` + instruction; may edit draft whitelist paths（write-policy：該 run 的 `draft_dir`＋`reports/`）and update report Narrative
4. Server `finalizeDraftFromDisk` → involvements 校驗 → `finalizeDreamReport`（寫入／覆寫 `## Amend feedback`）；**不**重跑 higher-chain rollup cascade
5. 先回到 `pending_review`（`job_id`＝同一 run id）；若 `dream_auto_approve` 則隨即自動 approve

**On failure:** `dream_job.status=failed`；**pending 與 draft 保留**（仍可 approve／discard／retry／再 amend）；`dream_status` 因 pending 仍在而維持 `pending_review`。

**Response `202`**

```json
{
  "job_id": "dream-…",
  "status": "started",
  "message": "Dream amend submitted. …"
}
```

**Errors**

| Status | error | When |
|--------|-------|------|
| `400` | `missing_instruction` | Missing／blank `instruction` |
| `409` | `no_pending` | No pending dream |
| `409` | `dream_run_mismatch` | Body id ≠ active pending |
| `409` | `dream_locked` | Extract／commit／amend in progress |

產品 UI：**Revise** 內二選一 — **re-dream** → 本節 retry；**amend-dream** → 本節 amend。

---

## `GET /dreams/pending`

Always **200**. No pending → empty shape (not 404).

**Empty**

```json
{
  "present": false,
  "dream_run_id": null,
  "scope": [],
  "report": null,
  "draft_summary": null,
  "node_score_involvements": []
}
```

**Present:** `present: true` plus filled fields; `report` is fixed-structure markdown; `draft_summary` summarizes draft paths (0.16+: no typed `patches` array):

```json
{
  "entry_count": 3,
  "chain_days": ["2026-07-22"],
  "chain_summary_days": ["2026-07-22"],
  "chain_weeks": [],
  "chain_months": [],
  "chain_years": [],
  "future_ids": ["fs-2026-07-31-deadline"],
  "clarify_distilled_node_ids": ["acme"]
}
```

`chain_days` = ledger files (`days/{id}.md`); `chain_summary_days` = summary files (`days/{id}.summary.md`).

**`clarify_distilled_node_ids`** (0.30+): node ids touched by clarify distill this run（from `DreamRunState`, not report-only）. Always an array when `present: true`（no change → `[]`）. When `present: true`, `draft_summary` is always an object（may have `entry_count: 0`).

**`node_score_involvements`** (0.19+): collapsed list from draft `node-score-involvements.yaml` — `{ id, category, reason? }` with `category` ∈ `mention`｜`update`｜`focus`. Missing／empty artifact → `[]`.

**Report `## Clarify distill`** (0.30+): between involvements／rollup and Structure notes. Empty → `_None_`.

**Report `## Structure notes`** (0.28+): server soft-lint of draft node mains (`memories/nodes/{id}/{id}.md`) — missing standing headings、Relation mentioning a known node without wikilink、broken `[[nodes/…]]`. Empty → `_None_`. Warnings **do not** fail the job or block `POST /dreams/approve`.

Node standing understanding path (0.28+): `memories/nodes/{id}/{id}.md`（API field still `understanding`）. Obsidian vault root＝`{ENGRAM_STORE_DIR}/memories/`.

---

## `GET /dreams/reports`

List **committed** dream reports whose markdown file still exists (TTL not yet deleted). Always **200**. Empty → `{ "items": [] }` (not 404). No query／pagination; extra query ignored. Extract／deploy／`pending_review` **allow** GET (never `409 dream_locked`). Newest `committed_at` first (fallback `created_at`; tie → `id` `localeCompare` ascending).

Does **not** include `pending`／`discarded`／`superseded`, orphan markdown without yaml, or committed yaml whose report file is gone. `l1_clear_pending: true` **is** included.

Each item: `dream_run_id`, `created_at`, `committed_at`, `patch_count`, `l1_clear_pending`, `narrative_preview` (flattened `## Narrative` body, max 80 UTF-16 units + `…`; empty → `null`). **No** full `report`, draft paths, or involvements array.

```json
{
  "items": [
    {
      "dream_run_id": "dream-…",
      "created_at": "…",
      "committed_at": "…",
      "patch_count": 2,
      "l1_clear_pending": false,
      "narrative_preview": "…"
    }
  ]
}
```

Workbench: `#/dream-reports`／`#/dream-reports/{id}`.

---

## `GET /dreams/reports/{id}`

Always **200** for a syntactically valid id. Committed **and** file present → `{ "present": true, "dream_run_id", "created_at", "committed_at", "patch_count", "l1_clear_pending", "report" }` (`report` = full markdown). Otherwise `{ "present": false }` (including pending／discarded／unknown／missing file). **Not** 404.

Illegal id (empty, path separators) → **400** `invalid_dream_run_id` (same style as other `:id` routes).

Pending reports remain on `GET /dreams/pending` only.

---

## `GET /memories/clarify/asking`

List open follow-ups（`asking/` only）, oldest → newest by `created_at`. Empty → `{ "items": [] }`（not 404）.

```json
{
  "items": [
    {
      "id": "…",
      "kind": "prompt",
      "created_at": "…",
      "source_dream_run_id": "…",
      "related_nodes": ["acme"],
      "question": "…"
    }
  ]
}
```

---

## `GET /memories/clarify/pending`

List live `pending/`（已答補問＋aside）, newest → oldest by `answered_at`（tie → `id` ascending `localeCompare`）. Empty → `{ "items": [] }`（not 404）. No query／pagination；extra query ignored. Read does **not** take the clarify write lock；extract／deploy／`pending_review` **allow** GET（never `409 dream_locked`). Distill／snapshot still use store `listPendingItems()` oldest→newest.

```json
{
  "items": [
    {
      "id": "…",
      "kind": "prompt",
      "created_at": "…",
      "answered_at": "…",
      "source_dream_run_id": "…",
      "related_nodes": ["acme"],
      "question": "…",
      "answer": "…"
    },
    {
      "id": "…",
      "kind": "aside",
      "created_at": "…",
      "answered_at": "…",
      "source_dream_run_id": null,
      "related_nodes": [],
      "question": null,
      "answer": "…"
    }
  ]
}
```

Workbench 事件頁「近期輸入內容」區（2）讀此列表；提問郵箱仍只 `GET asking`。

---

## `POST /memories/clarify/asking/{id}/submit`

Body: `{ "answer": "…" }`（trim 後非空；UTF-8 ≤16KiB）. Moves asking → pending with `## Answer`. Success **200** `{ "id", "queue": "pending" }`. Missing asking → **404**. Extract／deploy **allows** writes（0.41；不進本場釐清快照）.

---

## `DELETE /memories/clarify/asking/{id}`

Dismiss＝true-delete asking file. Missing → **200** idempotent. Does **not** enter history. Extract／deploy **allows** dismiss（0.41）.

---

## `POST /memories/clarify/aside`

Body: `{ "raw": "…" }`（trim 後非空；≤16KiB）. Creates pending `kind: aside`（**not** L0／STM／ledger）. Success **201** `{ "id", "queue": "pending" }`. Extract／deploy／`pending_review` **allow** writes；中途 aside **不**進本場 distill 快照.

Clarify queues live under `memories/clarify/{asking,pending,history}/`. Dream pipeline ends with `clarify_distill` → `clarify_generate` before `pending_review`. Approve archives `clarify_pending_snapshot_ids` ∩ pending → `history/`（even when `empty_patches`）.

---

## `PATCH /dreams/pending/node-score-involvements`

**2a** — while `pending_review`, change the category of an id already listed in the involvements artifact. Does **not** change live scores (settlement is on approve). Does **not** add／remove rows.

**Request:** `{ "id": "acme", "category": "update" }`

| Result | Status | `error` |
|--------|--------|---------|
| ok | 200 | — body `{ ok, id, category, reason }` |
| illegal category | 400 | `invalid_category` |
| id not in artifact | 404 | `involvement_not_found` |
| no pending | 409 | `no_pending` |
| missing fields | 400 | `missing_id`／`missing_category` |

Rewrites the report section `## Node score involvements` from the updated artifact.

---

## `POST /dreams/approve`

Sync. Body optional: `{ "dream_run_id": "…" }` (mismatch → 409).

1. If `l1_clear_pending` → **only retry clear S**
2. Else require active pending
3. Reject future day ids in draft chain paths → **409** `future_chain_id` + `rejected_chain_ids` (pending／draft／short-term／L2 unchanged)
4. Full maintain on draft `upcoming.md`／`longTerm.md` (rebucket／sort；out-of-window dropped from draft). Still-expired items → **409** `stale_future_anchor` + `rejected_future_ids`
5. Empty draft (no manifest entries and no deletes) → no L2／future-sight write；**no node-score settlement**；still clear S
6. Else deploy draft → live (deletes then copy)；then **settle node scores** on live（boost listed pre-existing nodes；downscale if any score > S_max with `exclude_node_ids` = this-run creates；init creates at S0）；path-only git rollback on deploy failure；then clear S；`git commit` message contains `dream_run_id`（also stages short-term clear **and** score／registry paths）. Higher-chain init／revise is **summary file existence only**（no `initialized_*.yaml`）. **No** post-approve future-sight maintain (pre-dream／GET cover calendar)
7. Clear S failure → run `committed` + `l1_clear_pending`; L2 may already be git-committed; next approve retries clear only (+ scope-clear commit)

**Response `200`**

```json
{
  "dream_run_id": "dream-…",
  "committed": ["memories/nodes/acme/acme.md", "memories/future-sight/upcoming.md"],
  "cleared_scope": ["e0000000001", "e0000000002"],
  "l1_clear_pending": false,
  "empty_patches": false
}
```

**Errors:** `409` `no_pending` \| `dream_run_mismatch` \| `future_chain_id` \| `stale_future_anchor` \| `dream_locked`; `500` commit failure (L2 unchanged, short-term kept).

---

## `POST /dreams/discard`

Drop pending intent + draft. short-term／L2／live future-sight unchanged（**does not** roll back a pre-dream future-sight maintain commit）. Body optional `dream_run_id`.

**Response `200`:** `{ "dream_run_id": "…", "discarded": true }`

---

## `GET /memories/future-sight`

List near-horizon future-sight anchors from **`upcoming.md`＋`longTerm.md`**. Always **200**. Empty → `anchors: []`.

On each call: **expire-only maintain** — remove items with `anchor_end` &lt; today；append L0+short-term (`source: system/future_sight_expired`, `ingest_meta.reason: past_anchor_end`)；git commit with prefix `engram: future-sight maintain` when files change. **Does not** rebucket upcoming↔longTerm（that happens on `POST /dreams/run` before the agent）.

**Response `200`**

```json
{
  "anchors": [
    {
      "id": "fs-2026-07-31-deadline",
      "zone": "upcoming",
      "anchor_start": "2026-07-31",
      "anchor_end": "2026-07-31",
      "content": "Deadline…"
    }
  ],
  "swept_expired": ["fs-2026-07-20-old"],
  "future_sight_window_days": 365,
  "future_sight_upcoming_days": 30
}
```
`anchors`：先全部 upcoming（近→遠），再全部 longTerm。`swept_expired` = ids removed on **this** request only（GET 不做 out-of-window）.

Search／Ask 讀側見下節 `GET /memories/search` 與 `POST /memories/ask`（0.18+）。工作台可瀏覽同一清單：`#/memory/future`（0.40+；JSON 不變）。

---

## `GET /memories/short-term-memory`

short-term preview for Activities. **Does not** include chain or L2 nodes.

**Response `200`:** `{ entries: [{ id, ts, raw }], present }`

`present` is `true` when the pool has at least one entry. **Omits** `summary` and `node_notes`（0.35：衍生 markdown／按 node 分組 notes 已廢）。

---

## `GET /memories/search`

Keyword search across short-term memory, memory-chain, L2 nodes, and **future-sight** (`upcoming.md`＋`longTerm.md`). **`q` is required** (`400 missing_q` if omitted or blank). Only **matching** sections are returned.

**Query:**

| Param | Required | Meaning |
|-------|----------|---------|
| `q` | yes | Keyword (case-insensitive substring) |
| `scope` | no | Comma-separated: `l1`, `nodes`, `chain`, **`future`**. Default: all four. `400 invalid_scope` if empty or unknown value. **No** `future_hot`／`future_later` split |

**Response `200`:**

```json
{
  "q": "acme",
  "scope": ["nodes", "chain", "future"],
  "nodes": [
    { "node": "acme", "understanding": "…", "match_reason": "node_id" }
  ],
  "chain": [
    { "day_id": "2026-07-23", "id": "2026-07-23", "level": "day", "content": "…", "source": "summary" },
    { "id": "2026-W28-0706", "level": "week", "content": "…", "source": "summary" }
  ],
  "future_sight": [
    {
      "id": "game-xx-launch",
      "zone": "later",
      "anchor_start": "2026-12-01",
      "anchor_end": "2026-12-15",
      "content": "…",
      "match_reason": "content"
    }
  ]
}
```

`nodes[].understanding` = whole `{id}.md` standing understanding string (same field as node detail).

| Field | Meaning |
|-------|---------|
| `scope` | Scopes searched on this request (echo) |
| `nodes` | Present only when `nodes` in scope; L2 hits (`node_id`｜`what_content`) |
| `l1` | Present only when `l1` in scope; `null` when no short-term hit. Hit shape `{ entries: [{ id, ts, raw }] }`（match `raw` or `id`） |
| `chain` | Present only when `chain` in scope; day／week／month／year hits. Each has `id` + `level`; day also keeps `day_id` |
| `future_sight` | Present only when `future` in scope; upcoming＋longTerm keyword hits. Each has `id`, `zone` (`upcoming`\|`longTerm`), `anchor_start`／`anchor_end`, `content`, `match_reason` (`id`\|`content`\|`anchor`). Order: all upcoming first (near→far), then longTerm |

No matches → `200` with requested scope keys empty (`nodes: []`, `l1: null`, `chain: []`, or `future_sight: []`). Does **not** include `dream_status`. Search does **not** run full maintain (reads files as-is).

**Errors:** `400 missing_q`, `400 invalid_scope`

---

## `GET /memories/chain`

Day chain **index** (newest first). Lightweight: `day_id` + `preview` + `source`.

**Response `200`:**

```json
{
  "days": [
    { "day_id": "2026-07-23", "preview": "Engram 0.6.0 dream entry…", "source": "summary" }
  ],
  "present": true
}
```

| Field | Meaning |
|-------|---------|
| `days` | Sorted **day_id descending** (new → old); days with no content omitted |
| `preview` | First **80** chars（先把 node wikilink 換成 display text：`[[nodes/{id}/{id}\|label]]`／`[[id\|label]]` → `label`，無 alias 則 id；再正規化空白後截斷） |
| `source` | `summary` \| `ledger_fallback` |
| `present` | `days.length > 0` |

Empty store → `{ "days": [], "present": false }`.

---

## `GET /memories/chain/weeks` · `…/months` · `…/years`

Higher-granularity **index** (newest first). Same preview rules as day (80 chars).

**Response `200` examples:**

```json
{ "weeks": [{ "week_id": "2026-W25-0615", "start": "2026-06-15", "end": "2026-06-21", "preview": "…" }], "present": true }
{ "months": [{ "month_id": "2026-06", "preview": "…" }], "present": true }
{ "years": [{ "year_id": "2026", "preview": "…" }], "present": true }
```

| Field (weeks) | Meaning |
|---------------|---------|
| `week_id` | `YYYY-Www-MMDD` — ISO week-year + week；**`MMDD` = that week's Monday** (not an arbitrary day in the week) |
| `start` / `end` | Inclusive Mon–Sun as full `YYYY-MM-DD` (derived from id; always present for a valid id) |
| `preview` | Same as day index（display text then 80 chars） |

Empty → `present: false` and empty array (not 404).

## `GET /memories/chain/weeks/{week_id}` · `…/months/{month_id}` · `…/years/{year_id}`

**Detail** — higher summary markdown body (sectioned with short `##` titles; no `## Current` wrapper).  
Illegal id → **`400`** (`invalid_week_id` / `invalid_month_id` / `invalid_year_id`).  
Missing → **`200`** `{ …_id, content: null, present: false }`（week 仍含可推得之 `start`／`end`）。

Ids: week **`YYYY-Www-MMDD`**（ISO week；`MMDD`＝週一；與週一不符 → `invalid_week_id`），month `YYYY-MM`，year `YYYY`.

Week detail example:

```json
{
  "week_id": "2026-W30-0720",
  "start": "2026-07-20",
  "end": "2026-07-26",
  "content": "## …\n",
  "present": true
}
```
---

## `GET /memories/chain/{day_id}`

Single day **detail**. Path `day_id` must match `YYYY-MM-DD` or **`400 invalid_day_id`**.

**Response `200` (has content):** `{ day_id, content, source, present: true }`  
**Response `200` (no file):** `{ day_id, content: null, source: "empty", present: false }`

---

## `GET /memories/nodes`

L2 node **index** (id ascending). Lightweight: `node` + `preview` + activity score fields.

**Response `200`:**

```json
{
  "nodes": [
    { "node": "engram", "preview": "Release cadence…", "score": 180, "display_score": 100 }
  ],
  "present": true
}
```

- `preview`：與 chain index 同一 helper（node wikilink → display text，再 80 字）
- `score`：帳面分；無 `score.yaml` → `null`
- `display_score`：`ceil(score / max_score * 100)`；無有效 `max_score` → `null`（UI 顯示 —）

Empty → `{ "nodes": [], "present": false }`.

---

## `GET /memories/nodes/graph`

L2 **network** for Memory 節點模式：點＝與 `GET /memories/nodes` 同一集合／欄位；邊＝各 `{id}/{id}.md` 內 P1 wikilink `[[nodes/{other}/{other}|…]]` 的無向引用（**不**掃 chain／STM／activities）。無 query。**不**寫磁碟。

**Response `200`:**

```json
{
  "present": true,
  "nodes": [
    { "node": "acme", "preview": "…", "score": 180, "display_score": 100 }
  ],
  "edges": [
    { "a": "acme", "b": "engram", "refs": 3, "level": 2 }
  ]
}
```

- `present`：至少一顆 L2 node（與 index 相同）→ `true`；否則 `false`
- `nodes[]`：與 `GET /memories/nodes` 同一集合、同一欄位；`node` 字串升序
- `edges[]`：無向；`a < b`（字串）；`refs` ≥ 1；`level = clamp(max(1, ceil(log2(refs))), 1, 10)`。無邊 → `[]`（即使 `present: true`）
- 忽略：非法 id、自指、指向沒有 live `{other}/{other}.md` 的 id
- 空庫 → `{ "present": false, "nodes": [], "edges": [] }`（**200**，不是 404）

---

## `GET /memories/nodes/{node_id}`

Single node **detail** — **`understanding`** is the **whole-file** body of `memories/nodes/{id}/{id}.md`（**not** “Current situation section only”). Obsidian vault root＝`memories/`（開該資料夾，不是 store 根）。

- **0.25+ expectation:** standing understanding with fixed headings in order: `## Identity` → `## Relation` → `## Standing facts` → `## Current situation` (empty sections use `_None_`). Event diaries belong in **chain**, not here.
- **0.16–0.24:** whole file = latest understanding (no `## Current`／`## History` contract).
- Pre-0.16 stores may still use `## Current`; readers peel that for unmigrated files.
- **0.26 breaking:** response key renamed from `what_current` → `understanding`（same body）.

Illegal path chars → **`400 invalid_node_id`**.  
Missing node → **200** `{ node, understanding: null, present: false, score: null, display_score: null, score_timestamp: null }`.

Present also returns `score`／`display_score`／`score_timestamp`（有檔時）.

---

## `POST /memories/ask`

Start async AI ask. Agent reads `ENGRAM_STORE_DIR` directly (read-only).

**Request:**

| Field | Required | Type | Default | Meaning |
|-------|----------|------|---------|---------|
| `q` | yes | string | — | Natural-language question |

**Response `202`:** `{ job_id, status: "started" }`  
**Errors:** `400 missing_q`；`400 include_later_removed`（body 出現已廢除的 `include_later` 鍵；Ask 恆可讀 `upcoming.md`＋`longTerm.md`）；`409 ask_busy`

Poll **`GET /memories/ask/{job_id}`** until `status` is `completed` | `failed` | `cancelled`.  
Cancel running job: **`POST /memories/ask/{job_id}/cancel`**.

**`GET /memories/ask/recent`** — 近 24 小時終態問答＋可能的 running。無 query／分頁；多餘 query 忽略。空亦 **200** `{ "items": [] }`。新→舊（`started_at` 降序；同分 `job_id` `localeCompare` 升序）。每筆：`job_id`、`q`、`status`、`started_at`、`completed_at`（可 null）、`answer_preview`（trim 後空白→`null`，否則最多 80 個 UTF-16 code unit＋`…`）。**不**回完整 `answer`、**不**回 `sources`。

單筆仍走 **`GET /memories/ask/{job_id}`**：先 temp job，再 `dreams/ask-history/{job_id}.json`；皆無則 **200** `{ "present": false }`。終態寫入 history 的條件：有效 `ask_history_retention_hours`（workspace → `ENGRAM_ASK_HISTORY_RETENTION_HOURS` → **24**）**> 0**。`0`＝不寫；sweep 會清既有檔。筆數帽 `ask_history_max_entries`（→ `ENGRAM_ASK_HISTORY_MAX_ENTRIES` → **50**）。history 不進 `memories/**`、不進 store git。

`GET /status.dream_cleanup` 在有掃過後含 `run_yamls_removed`／`input_jsons_removed`（與 `reports_removed`／`event_dirs_removed` 並列；dry-run 同樣填）。`dream_committed_report_retention_days=-1` 時 committed 的 report／events／yaml／input **都不** TTL 刪。

Agent may cite `sources[].kind` = `L1`｜`L2`｜`chain`｜**`future_sight`**（建議帶 `id`＋`zone`）。Every job may read both `upcoming.md` and `longTerm.md`; the agent decides what to open.

`job_id` shape: `ask-YYYYMMDD-HHmmss-{rand6}` (ENGRAM_TZ local time; URL-safe, no encoding).

`ENGRAM_AGENT`: `claude` (default) | `cursor` | `codex` | `mock-ask-ok` (ask tests). Dream also supports `mock-ok` | `mock-fail`.

---

## `POST /dreams/cancel`

Cancel a **running** dream (kill extract agent + remove draft). Optional body `{ "dream_run_id" }`.  
**409** when no running job. Distinct from **`POST /dreams/discard`** (pending_review only).

---

## Dream status

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No successful extract recorded |
| `pending_review` | Unique pending run awaiting approve／discard／retry／amend（`dream_auto_approve=true` 時成功路徑通常不會停在此狀態） |
| `l1_clear_pending` | Commit done; scope clear failed — retry approve |
| `dream_incomplete` | Last extract／materialize failed; short-term retained |
| `ok` | Steady state |

---

## Patch types (materialize → draft → commit)

| Type | On approve |
|------|------------|
| `propose_node` | Create live node under `memories/nodes/{id}/` (seed what／meta) |
| `semantic` (`facet: what`) | Update `memories/nodes/{id}/{id}.md` |
| `chain` (`level: day`) | Dual-track: append ledger `memories/chain/days/{YYYY-MM}/{id}.md` **and** init／revise summary `…/{id}.summary.md`. Occurrence day only; future day ids blocked at approve. Legacy without `summary` → ledger only. |
| `chain` (`level: week`｜`month`｜`year`) | Summary-only rollup from post-extract planner／writer (not day extract). Paths: `weeks/…`、`months/…`、`years/…`. `summary` + `summary_operation` required; no ledger. |
| `future` | Legacy typed patch helper — upserts into `upcoming.md`／`longTerm.md` when still in window；主路徑為 file pipeline 整檔改兩區 |
| `episodic` (confidence &lt; 0.6) | Attribution candidate |
| `episodic` (≥ 0.6) | No-op (chronology not in prototype) |

Same-run order: create new nodes first, then semantic／episodic for those ids. `future` may appear anywhere after creates.

---

## Typical session flow

```
POST /attachments/uploads  (optional: upload images for activities)
POST /activities  (one or more; also OK during pending_review; raw may contain ![[_attachments/uploads/…]] embeds)
     ↓
POST /dreams/run  → 202
     ↓
GET  /status  until dream_status=ok（預設自動 approve）or pending_review（dream_auto_approve=false）or dream_job failed
     ↓
GET  /dreams/pending  (read report)
     ↓
POST /dreams/approve   OR   POST /dreams/discard   OR   POST /dreams/retry   OR   POST /dreams/amend
     OR   POST /dreams/cancel (while running)
     ↓
GET  /dreams/reports  →  GET /dreams/reports/{id}  (committed reports until TTL)
     ↓
GET  /memories/search?q=…&scope=l1,nodes,chain,future
GET  /memories/chain  →  GET /memories/chain/{day_id}
GET  /memories/nodes  →  GET /memories/nodes/{node_id}
GET  /memories/nodes/graph
POST /memories/ask { "q": "…" }  →  GET /memories/ask/{job_id}
```

---

## curl examples

```bash
BASE=http://localhost:8787

curl -s "$BASE/status" | jq .

curl -s -X POST "$BASE/activities" \
  -H 'content-type: application/json' \
  -d '{"raw":"早兩天確認了需求","source":"api"}' | jq .

# optional: upload image → capture with embed + attachments[]
curl -s -X POST "$BASE/attachments/uploads" -F 'file=@menu.png' | jq .
# then POST /activities with raw containing ![[_attachments/uploads/…]] and matching attachments[]

curl -s -X POST "$BASE/dreams/run" | jq .
# poll
curl -s "$BASE/status" | jq '{dream_status,dream_job,dream_pending}'
curl -s "$BASE/dreams/pending" | jq '{present,dream_run_id,scope}'
curl -s -X POST "$BASE/dreams/approve" -H 'content-type: application/json' -d '{}' | jq .
```
