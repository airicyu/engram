---
name: engram-activities-integration
description: Guide building external integrations that write Engram activities via POST /activities — webhooks, cron scripts, other services. Use when the user wants to connect an app, bot, or pipeline to Engram, scaffold capture code, or document how events should flow into L0. Not for operating dream/approve/search (use engram-workbench).
---

# Engram Activities Integration

Help **integrators** send events into Engram over HTTP. Output: working capture code, retry guidance, and clear boundaries.

**You produce integration artifacts.** You do **not** edit `ENGRAM_STORE_DIR`, `data/`, or memory files. You do **not** run dream／approve unless the user explicitly asks for the full consolidate flow (→ [engram-workbench](../engram-workbench/SKILL.md)).

## When to use this skill vs workbench

| Situation | Skill |
|-----------|-------|
| "幫我的 GitHub bot 寫入 Engram" | **This skill** |
| "Webhook 接到 Engram" | **This skill** |
| "批次匯入舊日記" | **This skill** |
| "記一下…"（在 Cursor 裡直接 capture） | [engram-workbench](../engram-workbench/SKILL.md) |
| "跑 dream／approve／搜尋" | [engram-workbench](../engram-workbench/SKILL.md) |

## Config

| Env | Default |
|-----|---------|
| `ENGRAM_URL` | `http://localhost:8787` |

Prototype has **no auth**. Integrations assume a trusted network (localhost or private LAN).

**API contract:** [../../../docs/api-docs/api.md](../../../docs/api-docs/api.md) — `POST /activities` section.

## Capture contract (do not guess fields)

**Request:** `POST /activities`  
**Body (JSON):**

| Field | Required | Notes |
|-------|----------|-------|
| `raw` | **yes** | Free-text event. **Not** `content`／`text`. |
| `source` | no | Stable integrator id (e.g. `github`, `my-cron`, `journal-app`). Default server: `api`. |
| `node_refs` | no | `string[]` only — never a single string. |
| `idempotency_key` | no | Stored on the event for audit; **no server-side dedup yet** — integrator must handle retries. |
| `attachments` | no | `{ path: string, relationship: string }[]` (0.29+). Upload files first via `POST /attachments/uploads` (multipart `file`), then reference the returned `path` in `raw` as `![[path]]` and list in `attachments[]`. |

**Success:** `201` → `{ "event_id": "e0000000001" }`

**Errors:**

| Status | Meaning | Integrator action |
|--------|---------|-------------------|
| `400` | Missing `raw`, bad `node_refs`, or attachment validation error | Fix payload |
| `409` `dream_locked` | Extract／commit in progress | Retry with backoff (see below) |
| Connection refused | Server down | Queue or fail loudly |

**Allowed during `pending_review`** — capture does not require dream to be idle except during lock.

**Do not send client `ts`.** To backdate, set virtual clock first (`PUT /clock`, needs `ENGRAM_ALLOW_VIRTUAL_CLOCK=1`) — rare for integrations; see API doc.

## Integration patterns

### 1. Fire-and-forget (simplest)

One HTTP POST per event. Accept `409 dream_locked` → sleep 30–60s, retry up to N times.

### 2. Local queue (recommended for bots)

Append to a local file／SQLite queue → worker drains with `POST /activities`. Survives Engram restarts and dream locks.

### 3. Batch import

Loop events chronologically. For historical backfill, consider `PUT /clock` per day (dev／test) or accept wall-clock order for bulk one-off imports.

### `source` conventions

Use a **stable, low-cardinality** `source` per integrator:

- `github-issues`, `apple-health-export`, `manual-import`
- Not per-user ids in `source` — put those in `raw` or future `ingest_meta` if needed.

### After capture

Events land in **L0** + **short-term pool**. They are **not** long-term memory until:

1. `POST /dreams/run` → pending
2. Human `POST /dreams/approve`

Tell integrators: **capture-only is valid**; consolidate via UI or [engram-workbench](../engram-workbench/SKILL.md).

## Health check

Before wiring production traffic:

```bash
curl -sS "${ENGRAM_URL:-http://localhost:8787}/status" | jq '{ok: .store_git, dream_status: .dream_status, lock: .lock}'
```

## Deliverables (what you should produce)

When helping an integration:

1. Minimal **working code** (curl, Bun, Python — match user's stack)
2. **`ENGRAM_URL`** config note
3. **Retry** behavior for `409 dream_locked`
4. Explicit **out of scope**: no direct file writes, no auto-approve unless user requests policy

## Sub-files

- [patterns.md](patterns.md) — copy-paste examples (curl, Bun, Python, webhook handler)
