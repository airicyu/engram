# Engram API Reference (operator)

Canonical spec: [../../../api-docs/api.md](../../../api-docs/api.md)

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |

## Helper script

From repo root:

```bash
.claude/skills/engram-operator/scripts/engram-api.sh <command> [args]
```

Commands: `status` | `ingest <text> [source]` | `dream` | `activate [q]` | `root`

## curl catalog (bash)

```bash
export ENGRAM_URL="${ENGRAM_URL:-http://localhost:8787}"

# discovery
curl -s "$ENGRAM_URL/"

# status
curl -s "$ENGRAM_URL/status"

# ingest — minimal
curl -s -X POST "$ENGRAM_URL/ingest" \
  -H 'content-type: application/json' \
  -d '{"raw":"記得明天開會","source":"claude-skill"}'

# ingest — with node_refs
curl -s -X POST "$ENGRAM_URL/ingest" \
  -H 'content-type: application/json' \
  -d '{"raw":"Alice 提到 Acme 整合進度","source":"claude-skill","node_refs":["alice"]}'

# dream run (may take minutes — Claude Code extract)
curl -s -X POST "$ENGRAM_URL/dream/run"

# activate — all nodes
curl -s "$ENGRAM_URL/activate"

# activate — keyword
curl -s "$ENGRAM_URL/activate?q=alice"
```

Pipe through `jq` when available for readable output.

## Response cheat sheet

### `GET /status`

```json
{
  "engram_home": "/abs/path/data",
  "lock": false,
  "l1_empty": false,
  "pending_dlq_count": 0,
  "dream_status": "ok",
  "dream_job": null
}
```

`dream_job` is `null` when no job is/was running. When a job exists:

```json
{
  "status": "running" | "completed" | "failed",
  "dream_run_id": "dream-...",
  "started_at": "2026-07-18T...",
  "completed_at": "..." | null,
  "result": { "applied": [...], "skipped": [...], "dead_letter": [...], "extract_status": "...", "resumed": false } | null,
  "error": "..." | null
}
```

### `POST /ingest` → `201`

```json
{ "event_id": "e000003" }
```

### `POST /dream/run` → `202` (async)

Dream now runs **asynchronously** — the endpoint returns immediately. Poll `GET /status` → `dream_job` to track progress.

```json
{
  "job_id": "dream-2026-07-18T23:10:00+08:00",
  "status": "started",
  "message": "Dream job submitted and running in background. Poll GET /status for progress."
}
```

### `POST /dream/run` → `409` (locked)

```json
{
  "error": "dream_locked",
  "message": "Dream already running. Check /status for progress."
}
```

If `lock_stale: true` appears in `/status`, the lock is from a crashed server — the next `POST /dream/run` will auto-break it and proceed.

### `GET /activate`

```json
{
  "query": "alice",
  "sources": ["L1", "chain", "L2"],
  "dream_status": "ok",
  "l1": { "summary": "…", "node_notes": {}, "present": true },
  "chain": { "day_id": "2026-07-18", "content": "…" },
  "nodes": [{ "node": "alice", "what_current": "…", "match_reason": "keyword" }]
}
```

## HTTP status codes

| Code | Endpoint | Meaning |
|------|----------|---------|
| `201` | `/ingest` | Event stored |
| `202` | `/dream/run` | Dream job submitted (async) |
| `200` | others | Success |
| `400` | `/ingest` | Missing `raw` |
| `404` | any | Unknown path |
| `409` | `/dream/run` | Dream job already running; poll `/status` |
| `500` | any | Server error |

## dream_status values

| Value | Operator action |
|-------|-----------------|
| `never_dreamed` | Normal for new store; run dream after ingest |
| `ok` | Steady state |
| `dream_incomplete` | Retry `POST /dream/run`; check `502` error message |
| `dead_letter_pending` | Report `pending_dlq_count`; manual DLQ review only |
