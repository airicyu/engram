# Engram HTTP API Reference

Base URL: `http://localhost:8787` (override with `PORT`).

All timestamps and dates use **Asia/Taipei**.

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
  "dream_status": "ok",
  "dream_job": null
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `engram_home` | string | Resolved `ENGRAM_HOME` path |
| `lock` | boolean | `true` while a dream run holds the lock |
| `lock_stale` | boolean? | Present only when `lock: true`; `true` if lock is older than 30 min (server crash recovery) |
| `l1_empty` | boolean | `true` when short-term memory has been cleared |
| `pending_dlq_count` | number | Patches in dead-letter queue awaiting review |
| `dream_status` | enum | See [Dream status](#dream-status) |
| `dream_job` | object? | Current async dream job state, or `null` if no job is/was running |

**`dream_job` object:**

```json
{
  "status": "running",
  "dream_run_id": "dream-2026-07-18T23:10:00+08:00",
  "started_at": "2026-07-18T23:10:00.000Z",
  "completed_at": null,
  "result": null,
  "error": null
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `status` | `"running"` \| `"completed"` \| `"failed"` | Current job state |
| `dream_run_id` | string | Dream run identifier |
| `started_at` | string | ISO timestamp when job was submitted |
| `completed_at` | string? | ISO timestamp when job finished (completed/failed only) |
| `result` | object? | Dream result (applied, skipped, dead_letter, extract_status, resumed) — completed only |
| `error` | string? | Error message — failed only |

---

## `POST /ingest`

Append one event to L0 and update L1 short-term memory.

**Request body**

```json
{
  "raw": "required — free-text memory input",
  "source": "api",
  "node_refs": ["optional-node-id"],
  "idempotency_key": "optional"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `raw` | yes | Non-empty string; trimmed before storage |
| `source` | no | Provenance label; default `"api"` |
| `node_refs` | no | Node IDs; also appends to `nodes/{id}/notes.md` in L1 |
| `idempotency_key` | no | Stored on event; dedup not enforced in prototype |

**Response `201`**

```json
{ "event_id": "e000001" }
```

Event IDs are sequential: `e000001`, `e000002`, …

**Errors**

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "raw is required" }` | Missing or blank `raw` |
| `409` | `{ "error": "dream_locked", "message": "Dream in progress; ingest rejected" }` | Dream lock held |
| `500` | `{ "error": "..." }` | Internal failure |

---

## `POST /dream/run`

Submit a dream job. The dream runs **asynchronously** in the background — the endpoint returns immediately with `202 Accepted`. Poll `GET /status` to track progress via the `dream_job` field.

If a previous run wrote patches but apply did not finish and L1 is still present, **resumes apply only** (skips extract) for that `dream_run_id`.

**Request body:** none

**Response `202` (job submitted)**

```json
{
  "job_id": "dream-2026-07-18T23:10:00+08:00",
  "status": "started",
  "message": "Dream job submitted and running in background. Poll GET /status for progress."
}
```

**Response `200` (legacy sync — may be removed)**

```json
{
  "dream_run_id": "dream-2026-07-18T23:10:00+08:00",
  "applied": ["p1", "p2"],
  "skipped": [],
  "dead_letter": [],
  "extract_status": "ok",
  "resumed": false
}
```

| Field | Meaning |
|-------|---------|
| `dream_run_id` | ISO timestamp id, e.g. `dream-2026-07-18T23:10:00+08:00` |
| `applied` | `patch_id` values successfully applied |
| `skipped` | Already applied or already in DLQ |
| `dead_letter` | `patch_id` values sent to dead-letter queue |
| `extract_status` | `"ok"` or `"skipped_resume"` |
| `resumed` | `true` when apply resumed without re-extracting |

**Response `502` (extract failed — legacy sync, may be removed)**

```json
{
  "extract_status": "failed",
  "dream_status": "dream_incomplete",
  "dream_run_id": "dream-2026-07-18T23:10:00+08:00",
  "error": "human-readable message"
}
```

On extract failure in async mode: the `dream_job.status` in `/status` will be `"failed"` with the error message. **L1 is preserved**, no new L0.5 patches committed. Retry with another `POST /dream/run`.

**Errors**

| Status | Body | When |
|--------|------|------|
| `409` | `{ "error": "dream_locked", "message": "Dream already running. Check /status for progress." }` | Another dream job in progress |
| `500` | `{ "error": "..." }` | Unexpected failure |

### Patch types applied by dream

| Type | Apply behavior |
|------|----------------|
| `semantic` (`facet: what`) | Update `nodes/{id}/understand/what.md` |
| `chain` (`level: day`) | Append/merge day chain file |
| `propose_node` | Upsert `candidates/nodes.yaml` |
| `episodic` (confidence &lt; 0.6) | Upsert `candidates/attribution.yaml` |
| `episodic` (confidence ≥ 0.6) | Not applied in prototype (skipped at apply layer) |

Patches targeting unknown nodes → individual patch goes to DLQ; other patches still apply. L1 is cleared after apply pass completes.

---

## `GET /activate`

Assemble an activation packet for retrieval / context injection.

**Query parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `q` | no | Keyword filter for node matching |

**Response `200`**

```json
{
  "query": "acme",
  "sources": ["L1", "chain", "L2"],
  "dream_status": "ok",
  "l1": {
    "summary": "- [2026-07-18T20:00:00+08:00] (e000001) …",
    "node_notes": { "alice": "- […] note line" },
    "present": true
  },
  "chain": {
    "day_id": "2026-07-18",
    "content": "## 2026-07-18\n…"
  },
  "nodes": [
    {
      "node": "alice",
      "what_current": "…",
      "match_reason": "keyword"
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `query` | Echo of `q`, or `null` |
| `sources` | Which layers contributed: `L1`, `L2`, `chain`, `gap` |
| `dream_status` | Same enum as `/status` |
| `l1.present` | `false` when L1 has been cleared after dream |
| `nodes[].match_reason` | `all_nodes` \| `keyword` \| `node_refs_l1` \| `what_content` |

**Node matching rules**

- No `q`: include all nodes that have L2 current or L1 notes (prototype ≤3 nodes).
- With `q`: match node id substring, L1 node notes, or `what_current` content (case-insensitive).
- `gap` in `sources` when query provided but nothing matched and L1/chain are empty.

---

## Dream status

`dream_status` appears on `/status` and `/activate`.

| Value | Meaning |
|-------|---------|
| `never_dreamed` | No patches have been written yet |
| `dream_incomplete` | Extract failed with L1 retained, or unapplied patches exist while L1 present |
| `dead_letter_pending` | One or more patches in DLQ |
| `ok` | Normal steady state |

**Recommended client flow when `dream_incomplete`:**

1. `GET /status` — confirm `l1_empty: false`
2. `POST /dream/run` — retry (may resume apply if patches already exist)
3. If `502` persists, inspect server logs / Claude Code extract output

---

## Error envelope

Most errors return:

```json
{ "error": "message" }
```

Dream-lock conflicts use:

```json
{ "error": "dream_locked", "message": "…" }
```

---

## Typical session flow

```
POST /ingest  (one or more times)
     ↓
GET  /status  (optional: confirm L1 not empty, lock false)
     ↓
POST /dream/run  → 202 Accepted (async, returns immediately)
     ↓
GET  /status  (poll for dream_job.status → "completed" or "failed")
     ↓
GET  /activate?q=…   (before/after comparison)
```

**Concurrency:** Only one dream job at a time. `POST /dream/run` returns `409` if a job is already running. If the lock is stale (>30 min, e.g., server crash), it is automatically broken and a new job is accepted.

---

## curl examples

```bash
BASE=http://localhost:8787

curl -s "$BASE/status" | jq .

curl -s -X POST "$BASE/ingest" \
  -H 'content-type: application/json' \
  -d '{"raw":"記得明天要跟 Alice 對齊 Acme 整合","source":"claude-skill","node_refs":["alice"]}' | jq .

curl -s -X POST "$BASE/dream/run" | jq .
# 202: { "job_id": "dream-...", "status": "started", "message": "..." }
# Then poll: curl -s "$BASE/status" | jq .dream_job

curl -s "$BASE/activate?q=alice" | jq .
```
