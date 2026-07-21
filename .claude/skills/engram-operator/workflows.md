# Engram Operator Workflows

All steps use HTTP only. Base: `${ENGRAM_URL:-http://localhost:8787}`.

## 0. Preflight

1. `GET /status` (or `engram-api.sh status`)
2. If connection fails → ask user to start server: `cd server && bun run start`
3. Note `lock`, `lock_stale`, `l1_empty`, `dream_status`, `pending_dlq_count`, `dream_job`

## 1. Capture memory (ingest)

When the user wants to record something:

1. Optionally ask for `node_refs` if they mention a known node id
2. **Check [api-reference.md](api-reference.md) for field names** — the required field is `raw` (NOT `content`, `text`, or `message`)
3. `POST /ingest` with `{ "raw": "…", "source": "claude-skill", "node_refs": [...] }`
4. Confirm `event_id` returned (NOT `id`)
5. Optionally `GET /status` — expect `l1_empty: false`

**While `lock: true`:** ingest returns `409`. Wait for dream to finish or report the conflict.

## 2. Run dream

When the user wants to consolidate short-term memory into L2 / chain / candidates:

1. `GET /status` — if `lock: true` with `lock_stale: false`, a dream is already running; wait or inform user
2. `POST /dream/run` — **returns immediately** (async, 202 Accepted)
3. Interpret response:
   - `202` + `job_id` + `status: "started"` — dream submitted successfully
   - `409` — another dream job already running; poll `/status` for completion
4. **Poll** `GET /status` → `dream_job`:
   - `status: "running"` — still in progress (Claude Code extract + apply)
   - `status: "completed"` → summarize `result.applied`, `result.skipped`, `result.dead_letter`
   - `status: "failed"` → report `dream_job.error`; **L1 preserved**; safe to retry
5. After `completed`: `GET /status` — expect `l1_empty: true`
6. `GET /activate` — show before/after context if useful

### Resume behavior

If a prior run wrote patches but apply did not finish:

- Next `POST /dream/run` may resume with `result.resumed: true`, `result.extract_status: "skipped_resume"`
- No duplicate L0.5 append for same `dream_run_id`

### Stale lock recovery

If the server crashed mid-dream, the lock file persists. After 30 minutes:

- `GET /status` shows `lock: true, lock_stale: true`
- Next `POST /dream/run` auto-breaks the stale lock and proceeds

## 3. Read memory (activate)

When the user asks what Engram knows:

1. `GET /activate` — no query → all nodes (prototype ≤3)
2. `GET /activate?q=keyword` — scoped retrieval
3. Present:
   - `dream_status` and `sources`
   - `l1.summary` if `l1.present`
   - `chain.content` for today
   - `nodes[]` with `what_current` and `match_reason`

If `sources` contains `gap`, nothing matched the query.

## 4. Daily loop (typical)

```
ingest (throughout day)
  → status (optional)
  → dream/run (end of day or on demand)
  → activate (verify L2 / chain)
```

## 5. Error handling

| Situation | Action |
|-----------|--------|
| `dream_locked` on ingest | Dream in progress; retry ingest after dream completes |
| `dream_job.status: "failed"` | Show `dream_job.error`; suggest retry `dream/run`; do not edit data files |
| `lock_stale: true` | Server crashed; next `POST /dream/run` auto-recovers |
| `dead_letter_pending` | Report count; patches need manual DLQ review (no API) |
| `propose_node` in candidates | Tell user to approve manually under `candidates/nodes.yaml` |
| User wants empty store | Confirm destructively, then `cd server && bun run reset` |

## 6. What not to do

- Do not read `data/` to answer "what's in memory" — use `/activate`
- Do not write yaml/md under `ENGRAM_HOME` to fix failed patches
- Do not run `fixture:apply --seed` unless user explicitly wants test fixtures
