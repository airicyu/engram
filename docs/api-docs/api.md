# Engram HTTP API Reference

Base URL: `http://localhost:8787` (override with `PORT`).

All timestamps and calendar dates use the **effective** IANA timezone: `{ENGRAM_STORE_DIR}/engram.workspace.yaml` `timezone` if set, else `ENGRAM_TZ`, else **`Asia/Hong_Kong`**.

**Memory write language** (`memory_language`): workspace yaml → `ENGRAM_MEMORY_LANGUAGE` → **`en`**. Allowed values only: `zh-Hant`｜`zh-Hans`｜`en`. Controls language of **new** dream／rollup／ask prose (not L0 `raw`, not workbench UI i18n).  

**Store structure version** (`store_version`): optional semver in the same workspace yaml（例 `0.16.0`）. Missing → `GET /status.store_version` is `null`（server still starts）. Present but not `X.Y.Z` → **server refuses to start**. Server never auto-rewrites an existing／missing value to the product version on boot.

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
    "POST /dreams/run",
    "GET /dreams/pending",
    "GET /dreams/events",
    "POST /dreams/approve",
    "POST /dreams/discard",
    "POST /dreams/retry",
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
    "GET /memories/nodes/{node_id}",
    "POST /memories/ask",
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
  "store_version": "0.16.0",
  "product_version": "0.16.0",
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
  "future_sight_hot_count": 0,
  "future_sight_later_count": 0,
  "future_sight_window_days": 365,
  "future_sight_hot_days": 30,
  "dream_status": "pending_review",
  "dream_pending": {
    "dream_run_id": "dream-20260721-220000-a1b2c3",
    "scope_count": 2,
    "patch_count": 3
  },
  "l1_clear_pending": null,
  "dream_job": null
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `store_dir` | string | Resolved `ENGRAM_STORE_DIR` path |
| `store_git` | boolean | `true` when `ENGRAM_STORE_DIR` is a usable local git work tree (0.16+; server refuses to start otherwise) |
| `store_version` | string \| null | Disk **structure** generation from `engram.workspace.yaml` `store_version`（semver）；missing key → `null`（not a start failure） |
| `product_version` | string | Engram product version from repo `version.md`（for comparison； mismatch does **not** refuse start） |
| `temp_dir` | string | Resolved `ENGRAM_TEMP_DIR` (default `/tmp`) — ask jobs + dream agent disposable workdirs |
| `timezone` | string | Effective IANA zone (workspace yaml → `ENGRAM_TZ` → `Asia/Hong_Kong`) |
| `memory_language` | string | Effective write language: `zh-Hant`｜`zh-Hans`｜`en` |
| `clock` | object | Memory-timeline clock snapshot (see [Virtual clock](#virtual-clock)) |
| `lock` | boolean | `true` while extract／materialize／approve commit holds the lock |
| `lock_stale` | boolean? | Present only when `lock: true`; stale lock (>30 min) |
| `l1_empty` | boolean | `true` when short-term memory pool has no entries |
| `future_sight_active_count` | number | Total items in `hot.md`＋`later.md` (name kept for compatibility) |
| `future_sight_hot_count` | number | Items in `memories/future-sight/hot.md` |
| `future_sight_later_count` | number | Items in `memories/future-sight/later.md` |
| `future_sight_window_days` | number | Effective admission window (workspace → env → **365**) |
| `future_sight_hot_days` | number | Effective hot zone days (workspace → env → 30) |
| `dream_status` | enum | See [Dream status](#dream-status) |
| `dream_pending` | object? | Active pending summary, or `null` |
| `l1_clear_pending` | object? | Commit succeeded but scope clear failed — retry approve |
| `dream_job` | object? | Last／current async extract job |

**`dream_job` object:**

| Field | Meaning |
|-------|---------|
| `status` | `"running"` \| `"completed"` \| `"failed"` |
| `phase` | `"extract"` \| `"materialize"` \| `"pending_review"` |
| `log_tail` | When `status` is `"running"`: last ≤20 structured events (same shape as `GET /dreams/events`) |
| `result` | On success: `scope`, `patch_count`, `superseded` (always null since 0.12), `phase` |
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

Fixture JSONL lines: `{ "ts", "raw", "source?", "node_refs?" }` — `ts` is encoding time. Orchestrator: set clock → capture → dream at night → approve → next day.

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

**Allowed during `pending_review`** (no dream lock). Rejected only while lock is held (extract／commit).

**Request body**

```json
{
  "raw": "required — free-text memory input",
  "source": "api",
  "node_refs": ["optional-node-id"],
  "idempotency_key": "optional"
}
```

**Response `201`:** `{ "event_id": "e0000000001" }`

**Errors:** `400` missing `raw`; `409` `dream_locked`.

---

## `POST /dreams/run`

Async **extract → materialize draft → unique pending**. Does **not** write L2.

- Empty short-term memory pool → **409** `nothing_to_dream`
- Existing pending → **409** `pending_review`（禁止無理由取代；改用 `POST /dreams/retry` 或先 `discard`）
- Scope **S** = all event ids in the pool at call time
- Extract input = L0 events for S (may span days) + short-term view for S + existing L2
- `job_id` / `dream_run_id` shape: `dream-YYYYMMDD-HHmmss-{rand6}` (ENGRAM_TZ local time)

**Response `202`**

```json
{
  "job_id": "dream-20260721-220000-a1b2c3",
  "status": "started",
  "message": "Dream extract+materialize submitted. Poll GET /status; when pending_review, GET /dreams/pending then approve, discard, or retry."
}
```

**Errors**

| Status | error | When |
|--------|-------|------|
| `409` | `nothing_to_dream` | short-term memory pool empty |
| `409` | `pending_review` | Active pending exists — use retry／discard／approve |
| `409` | `dream_locked` | Another extract／commit in progress |

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
6. Completes to a new `pending_review` (failure path same as `/dreams/run`)

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

## `GET /dreams/pending`

Always **200**. No pending → empty shape (not 404).

**Empty**

```json
{
  "present": false,
  "dream_run_id": null,
  "scope": [],
  "report": null,
  "draft_summary": null
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
  "future_ids": ["fs-2026-07-31-deadline"]
}
```

`chain_days` = ledger files (`days/{id}.md`); `chain_summary_days` = summary files (`days/{id}.summary.md`).

---

## `POST /dreams/approve`

Sync. Body optional: `{ "dream_run_id": "…" }` (mismatch → 409).

1. If `l1_clear_pending` → **only retry clear S**
2. Else require active pending
3. Reject future day ids in draft chain paths → **409** `future_chain_id` + `rejected_chain_ids` (pending／draft／short-term／L2 unchanged)
4. Full maintain on draft `hot.md`／`later.md` (rebucket／sort；out-of-window dropped from draft). Still-expired items → **409** `stale_future_anchor` + `rejected_future_ids`
5. Empty draft (no manifest entries and no deletes) → no L2／future-sight write; still clear S
6. Else deploy draft → live (deletes then copy); path-only git rollback on deploy failure; then clear S; `git commit` message contains `dream_run_id` (also stages short-term clear). **No** post-approve future-sight maintain (pre-dream／GET cover calendar)
7. Clear S failure → run `committed` + `l1_clear_pending`; L2 may already be git-committed; next approve retries clear only (+ scope-clear commit)

**Response `200`**

```json
{
  "dream_run_id": "dream-…",
  "committed": ["memories/nodes/acme/understand/what.md", "memories/future-sight/hot.md"],
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

List near-horizon future-sight anchors from **`hot.md`＋`later.md`**. Always **200**. Empty → `anchors: []`.

On each call: **expire-only maintain** — remove items with `anchor_end` &lt; today；append L0+short-term (`source: system/future_sight_expired`, `ingest_meta.reason: past_anchor_end`)；git commit with prefix `engram: future-sight maintain` when files change. **Does not** rebucket hot↔later（that happens on `POST /dreams/run` before the agent）.

**Response `200`**

```json
{
  "anchors": [
    {
      "id": "fs-2026-07-31-deadline",
      "zone": "hot",
      "anchor_start": "2026-07-31",
      "anchor_end": "2026-07-31",
      "content": "Deadline…"
    }
  ],
  "swept_expired": ["fs-2026-07-20-old"],
  "future_sight_window_days": 365,
  "future_sight_hot_days": 30
}
```
`anchors`：先全部 hot（近→遠），再全部 later。`swept_expired` = ids removed on **this** request only（GET 不做 out-of-window）.

Search／Ask 讀側見下節 `GET /memories/search` 與 `POST /memories/ask`（0.18+）。

---

## `GET /memories/short-term-memory`

short-term preview for Activities. **Does not** include chain or nodes.

**Response `200`:** `{ summary, node_notes, present }`

---

## `GET /memories/search`

Keyword search across short-term memory, memory-chain, L2 nodes, and **future-sight** (`hot.md`＋`later.md`). **`q` is required** (`400 missing_q` if omitted or blank). Only **matching** sections are returned.

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
    { "node": "acme", "what_current": "…", "match_reason": "node_id" }
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

| Field | Meaning |
|-------|---------|
| `scope` | Scopes searched on this request (echo) |
| `nodes` | Present only when `nodes` in scope; L2 hits (`node_id` \| `what_content` \| `l1_note`) |
| `l1` | Present only when `l1` in scope; `null` when no short-term hit |
| `chain` | Present only when `chain` in scope; day／week／month／year hits. Each has `id` + `level`; day also keeps `day_id` |
| `future_sight` | Present only when `future` in scope; hot＋later keyword hits. Each has `id`, `zone` (`hot`\|`later`), `anchor_start`／`anchor_end`, `content`, `match_reason` (`id`\|`content`\|`anchor`). Order: all hot first (near→far), then later |

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
| `preview` | First **80** chars (whitespace-normalized) |
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
| `preview` | First **80** chars (whitespace-normalized) |

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

L2 node **index** (id ascending). Lightweight: `node` + `preview`.

**Response `200`:**

```json
{
  "nodes": [
    { "node": "engram", "preview": "Release cadence…" }
  ],
  "present": true
}
```

Empty → `{ "nodes": [], "present": false }`.

---

## `GET /memories/nodes/{node_id}`

Single node **detail** — narrative body of `what.md` (0.16+: whole file; pre-0.16 stores may still use `## Current`).  
Illegal path chars → **`400 invalid_node_id`**.  
Missing node → **200** `{ node, what_current: null, present: false }`.

---

## `POST /memories/ask`

Start async AI ask. Agent reads `ENGRAM_STORE_DIR` directly (read-only).

**Request:**

| Field | Required | Type | Default | Meaning |
|-------|----------|------|---------|---------|
| `q` | yes | string | — | Natural-language question |
| `include_later` | no | **boolean** | `false` | `true` → agent may／should read `later.md`; `false` → may read `hot.md`, **must not** read `later.md` |

**Response `202`:** `{ job_id, status: "started", include_later }`  
**Errors:** `400 missing_q`, `400 invalid_include_later` (non-boolean), `409 ask_busy`

Poll **`GET /memories/ask/{job_id}`** until `status` is `completed` | `failed` | `cancelled`（payload echoes `include_later`）.  
Cancel running job: **`POST /memories/ask/{job_id}/cancel`**.

Agent may cite `sources[].kind` = `L1`｜`L2`｜`chain`｜**`future_sight`**（建議帶 `id`＋`zone`）。

`job_id` shape: `ask-YYYYMMDD-HHmmss-{rand6}` (ENGRAM_TZ local time; URL-safe, no encoding).

`ENGRAM_AGENT`: `claude` (default) | `cursor` | `mock-ask-ok` (ask tests). Dream also supports `mock-ok` | `mock-fail`.

---

## `POST /dreams/cancel`

Cancel a **running** dream (kill extract agent + remove draft). Optional body `{ "dream_run_id" }`.  
**409** when no running job. Distinct from **`POST /dreams/discard`** (pending_review only).

---

## Dream status

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No successful extract recorded |
| `pending_review` | Unique pending run awaiting approve／discard／retry |
| `l1_clear_pending` | Commit done; scope clear failed — retry approve |
| `dream_incomplete` | Last extract／materialize failed; short-term retained |
| `ok` | Steady state |

---

## Patch types (materialize → draft → commit)

| Type | On approve |
|------|------------|
| `propose_node` | Create live node under `memories/nodes/{id}/` (seed what／meta) |
| `semantic` (`facet: what`) | Update `memories/nodes/{id}/understand/what.md` |
| `chain` (`level: day`) | Dual-track: append ledger `memories/chain/days/{YYYY-MM}/{id}.md` **and** init／revise summary `…/{id}.summary.md`. Occurrence day only; future day ids blocked at approve. Legacy without `summary` → ledger only. |
| `chain` (`level: week`｜`month`｜`year`) | Summary-only rollup from post-extract planner／writer (not day extract). Paths: `weeks/…`、`months/…`、`years/…`. `summary` + `summary_operation` required; no ledger. |
| `future` | Legacy typed patch helper — upserts into `hot.md`／`later.md` when still in window；主路徑為 file pipeline 整檔改兩區 |
| `episodic` (confidence &lt; 0.6) | Attribution candidate |
| `episodic` (≥ 0.6) | No-op (chronology not in prototype) |

Same-run order: create new nodes first, then semantic／episodic for those ids. `future` may appear anywhere after creates.

---

## Typical session flow

```
POST /activities  (one or more; also OK during pending_review)
     ↓
POST /dreams/run  → 202
     ↓
GET  /status  until dream_status=pending_review (or dream_job failed)
     ↓
GET  /dream/pending  (read report)
     ↓
POST /dreams/approve   OR   POST /dreams/discard   OR   POST /dreams/retry
     OR   POST /dreams/cancel (while running)
     ↓
GET  /memories/search?q=…&scope=l1,nodes,chain,future
GET  /memory/chain  →  GET /memories/chain/{day_id}
GET  /memory/nodes  →  GET /memories/nodes/{node_id}
POST /memories/ask { "q": "…", "include_later": false }  →  GET /memories/ask/{job_id}
```

---

## curl examples

```bash
BASE=http://localhost:8787

curl -s "$BASE/status" | jq .

curl -s -X POST "$BASE/capture" \
  -H 'content-type: application/json' \
  -d '{"raw":"早兩天確認了需求","source":"api"}' | jq .

curl -s -X POST "$BASE/dream/run" | jq .
# poll
curl -s "$BASE/status" | jq '{dream_status,dream_job,dream_pending}'
curl -s "$BASE/dream/pending" | jq '{present,dream_run_id,scope}'
curl -s -X POST "$BASE/dream/approve" -H 'content-type: application/json' -d '{}' | jq .
```
