---
name: engram-operator
description: Operate Engram memory via its HTTP API — ingest events, run dream (extract+apply), check status, activate context packets. Use whenever the user mentions Engram, memory ingest, dream run, activation, L1/L2, candidates, or wants to read or write Engram state. Always call the API; never edit files under ENGRAM_HOME or data/ directly.
---

# Engram Operator

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
**Overview:** [../../../api-docs/README.md](../../../api-docs/README.md)

**Helper:** `scripts/engram-api.sh` — thin curl wrapper for common calls.

## Boundaries

| Do | Don't |
|----|-------|
| `curl` / `engram-api.sh` against `ENGRAM_URL` | Edit `data/**`, `nodes/**`, `candidates/**`, `dream/**` |
| Use `POST /ingest` to capture memory | Append to `events.jsonl` by hand |
| Use `POST /dream/run` to consolidate L1 → L2 | Run fixture apply or mock extract unless user asks for dev testing |
| Use `GET /activate` to read context | Assemble context by reading markdown files |
| Report `dream_status`, DLQ count from `/status` | Manually fix DLQ or approve candidates via filesystem |

### Not exposed by API (prototype)

Tell the user these need **manual** steps outside this skill:

- Approve `propose_node` candidates → create `nodes/{id}/` directories
- Settle `dead-letter.jsonl` entries
- Wipe store → `cd server && bun run reset` (destructive; confirm first)

## Domain language

| Term | Meaning |
|------|---------|
| **Ingest** | `POST /ingest` — append L0 event + L1 short-term notes |
| **Dream** | `POST /dream/run` — Claude extract → patch apply → clear L1 |
| **Activate** | `GET /activate` — packet with L1, day chain, matched L2 nodes |
| **L1** | Short-term memory until dream clears it |
| **L2** | Long-term `what` understanding per node |
| **DLQ** | Dead-letter queue for patches that failed apply |
| **dream_status** | `ok` \| `dream_incomplete` \| `dead_letter_pending` \| `never_dreamed` |

## ⚠️ Before any API call

**Never guess field names.** The API is strict — wrong field names are rejected with `400`. Always verify against [api-reference.md](api-reference.md) before constructing a request body:

| Endpoint | Required field | Returns |
|----------|---------------|---------|
| `POST /ingest` | `raw` (not `content`, `text`, `message`) | `event_id` (not `id`) |
| `POST /dream/run` | none | `202` + `job_id` (async — poll `/status` → `dream_job`) |
| `GET /activate` | `q` (query param, optional) | `l1`, `chain`, `nodes` |

## Quick operations

```bash
# status
./.claude/skills/engram-operator/scripts/engram-api.sh status

# ingest (escape JSON in shell)
./.claude/skills/engram-operator/scripts/engram-api.sh ingest '今天討論了 API 設計'

# dream (async — returns immediately; poll /status for result)
./.claude/skills/engram-operator/scripts/engram-api.sh dream

# activate (optional query)
./.claude/skills/engram-operator/scripts/engram-api.sh activate alice
```

Or raw curl — see [api-reference.md](api-reference.md).

## Decision guide

| User intent | Action |
|-------------|--------|
| "記一下…" / capture a thought | `POST /ingest` |
| "整理記憶" / "跑 dream" | `GET /status` then `POST /dream/run` (async, returns 202 immediately); poll `dream_job` in `/status` for completion |
| "現在記憶裡有什麼" | `GET /activate` (with `q` if scoped) |
| "系統狀態" | `GET /status` |
| ingest while dreaming | Wait or report `409 dream_locked`; check `dream_job` for progress |
| dream job failed (dream_job.status: "failed") | Report error; L1 kept — safe to retry `POST /dream/run` |
| `dead_letter_pending` | Report count; manual DLQ review not in API |

## Sub-files

- [workflows.md](workflows.md) — Ingest → dream → activate, retry, status interpretation
- [api-reference.md](api-reference.md) — Full curl catalog and response fields
