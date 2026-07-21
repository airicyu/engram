# Engram HTTP API Reference

Base URL: `http://localhost:8787` (override with `PORT`).

All timestamps and dates use **Asia/Taipei**.

**Empty reads:** endpoints that mean “no content right now” return **200** with an empty body shape (`present: false`, `null`, `[]`) — **not 404**. 404 is only for unknown paths/methods.

---

## `GET /`

Service discovery.

**Response `200`**

```json
{
  "name": "engram",
  "endpoints": [
    "POST /ingest",
    "POST /dream/run",
    "GET /dream/pending",
    "POST /dream/approve",
    "POST /dream/discard",
    "GET /activate",
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
  "engram_home": "/path/to/data",
  "lock": false,
  "l1_empty": false,
  "pending_dlq_count": 0,
  "dream_status": "pending_review",
  "dream_pending": {
    "dream_run_id": "dream-2026-07-21T22:00:00+08:00",
    "scope_count": 2,
    "patch_count": 3
  },
  "l1_clear_pending": null,
  "dream_job": null
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `engram_home` | string | Resolved `ENGRAM_HOME` path |
| `lock` | boolean | `true` while extract／materialize／approve commit holds the lock |
| `lock_stale` | boolean? | Present only when `lock: true`; stale lock (>30 min) |
| `l1_empty` | boolean | `true` when L1 mem pool has no entries |
| `pending_dlq_count` | number | Legacy DLQ count |
| `dream_status` | enum | See [Dream status](#dream-status) |
| `dream_pending` | object? | Active pending summary, or `null` |
| `l1_clear_pending` | object? | Commit succeeded but scope clear failed — retry approve |
| `dream_job` | object? | Last／current async extract job |

**`dream_job` object:**

| Field | Meaning |
|-------|---------|
| `status` | `"running"` \| `"completed"` \| `"failed"` |
| `phase` | `"extract"` \| `"materialize"` \| `"pending_review"` |
| `result` | On success: `scope`, `patch_count`, `superseded`, `phase` |
| `error` | On failure |

---

## `POST /ingest`

Append one event to L0 and the L1 mem pool (indexed by event id).

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

**Response `201`:** `{ "event_id": "e000001" }`

**Errors:** `400` missing `raw`; `409` `dream_locked`.

---

## `POST /dream/run`

Async **extract → materialize draft → unique pending**. Does **not** write L2.

- Empty L1 pool → **409** `nothing_to_dream`
- Existing pending → **supersede** (discard old intent+draft; new extract on current pool)
- Scope **S** = all event ids in the pool at call time
- Extract input = L0 events for S (may span days) + L1 view for S + existing L2

**Response `202`**

```json
{
  "job_id": "dream-2026-07-21T22:00:00+08:00",
  "status": "started",
  "message": "Dream extract+materialize submitted. Poll GET /status; when pending_review, GET /dream/pending then approve or discard."
}
```

**Errors**

| Status | error | When |
|--------|-------|------|
| `409` | `nothing_to_dream` | L1 pool empty |
| `409` | `dream_locked` | Another extract／commit in progress |

On extract／materialize failure: `dream_job.status=failed` + `phase`; **no** pending; L1 unchanged.

**Cancelled (0.3):** auto-apply after extract; resume-apply of unapplied patches.

---

## `GET /dream/pending`

Always **200**. No pending → empty shape (not 404).

**Empty**

```json
{
  "present": false,
  "dream_run_id": null,
  "scope": [],
  "report": null,
  "patches": [],
  "draft_summary": null
}
```

**Present:** `present: true` plus filled fields; optional `draft_summary: { entry_count, chain_days }`.

---

## `POST /dream/approve`

Sync. Body optional: `{ "dream_run_id": "…" }` (mismatch → 409).

1. If `l1_clear_pending` → **only retry clear S**
2. Else require active pending
3. Reject future `chain.id` → **409** `future_chain_id` + `rejected_chain_ids` (pending／draft／L1／L2 unchanged)
4. Empty patches → no L2 write; still clear S
5. Else `commitDraft` → live L2; then clear S
6. Clear S failure → run `committed` + `l1_clear_pending`; next approve retries clear only

**Response `200`**

```json
{
  "dream_run_id": "dream-…",
  "committed": ["nodes/acme/understand/what.md"],
  "cleared_scope": ["e000001", "e000002"],
  "l1_clear_pending": false,
  "empty_patches": false
}
```

**Errors:** `409` `no_pending` \| `dream_run_mismatch` \| `future_chain_id` \| `dream_locked`; `500` commit failure (L2 unchanged, L1 kept).

---

## `POST /dream/discard`

Drop pending intent + draft. L1／L2 unchanged. Body optional `dream_run_id`.

**Response `200`:** `{ "dream_run_id": "…", "discarded": true }`

---

## `GET /activate`

Activation packet (unchanged shape). `dream_status` includes 0.3 values (`pending_review`, `l1_clear_pending`, …).

---

## Dream status

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No successful extract recorded |
| `pending_review` | Unique pending run awaiting approve／discard／supersede |
| `l1_clear_pending` | Commit done; scope clear failed — retry approve |
| `dream_incomplete` | Last extract／materialize failed; L1 retained |
| `dead_letter_pending` | Legacy DLQ non-empty |
| `ok` | Steady state |

---

## Patch types (materialize → draft → commit)

| Type | On approve |
|------|------------|
| `propose_node` | Create live node under `nodes/{id}/` (seed what／meta) |
| `semantic` (`facet: what`) | Update `nodes/{id}/understand/what.md` |
| `chain` (`level: day`) | Append `memory-chain/days/{id}.md` — **occurrence** day; future ids blocked at approve |
| `episodic` (confidence &lt; 0.6) | Attribution candidate |
| `episodic` (≥ 0.6) | No-op (chronology not in prototype) |

Same-run order: create new nodes first, then semantic／episodic for those ids.

---

## Typical session flow

```
POST /ingest  (one or more; also OK during pending_review)
     ↓
POST /dream/run  → 202
     ↓
GET  /status  until dream_status=pending_review (or dream_job failed)
     ↓
GET  /dream/pending  (read report)
     ↓
POST /dream/approve   OR   POST /dream/discard   OR   POST /dream/run (supersede)
     ↓
GET  /activate?q=…
```

---

## curl examples

```bash
BASE=http://localhost:8787

curl -s "$BASE/status" | jq .

curl -s -X POST "$BASE/ingest" \
  -H 'content-type: application/json' \
  -d '{"raw":"早兩天確認了需求","source":"api"}' | jq .

curl -s -X POST "$BASE/dream/run" | jq .
# poll
curl -s "$BASE/status" | jq '{dream_status,dream_job,dream_pending}'
curl -s "$BASE/dream/pending" | jq '{present,dream_run_id,scope}'
curl -s -X POST "$BASE/dream/approve" -H 'content-type: application/json' -d '{}' | jq .
```
