# Changelog

## 0.4.1 — Capture API rename (2026-07-22)

Unify product vocabulary: **Capture** subsumes Ingest.

### Changed

- **`POST /ingest` → `POST /capture`** (hard cut; no alias) — aligns API with UI Capture scene
- Web Capture submit button **寫入 → Capture**
- Workbench skill: `engram-api.sh capture` (replaces `ingest`)
- **L0.5 → L1.5** in domain language — intermediate layer between L1 and L2

### Unchanged

- Request body still uses **`raw`**; response still `{ "event_id" }`
- Lock rules: `pending_review` allows capture; dream lock → `409 dream_locked`

---

## 0.4.0 — Near-horizon future-sight (2026-07-22)

Independent future-sight anchors (day / short range), approved via dream; expiry marks an L0+L1 event then hard-deletes the live file. Recall (`/recall`) does **not** inject future-sight.

### Added

- **`future` patch** → `future-sight/active/{id}.md` on approve (draft-staged)
- **`GET /future-sight`** — list active anchors; lazy sweep expired
- Approve gate **`409 stale_future_anchor`** when `anchor_end` &lt; today
- `/status` field **`future_sight_active_count`**
- Extract／report: **Proposed future-sight**; far/vague foresight stays on node／day events (no new facets)

### Changed

- **`GET /activate` → `GET /recall`** (hard cut; no alias) — product vocabulary aligns with UI Recall
- Consolidate UI primary action **Extract → Dream**

### Fixed

- **`dream_run_id` uniqueness** — append entropy so two runs in the same second do not reuse patches via `appendPatchesIfNew`
### Unchanged

- Future `chain.id` still blocked (`409 future_chain_id`)
- `/recall` packet shape (no future-sight injection)

### Out of scope

- Short-term future mindzone (moving window) — backlog
- Recall injection of future-sight — backlog
- `when.md` facet, calendar sync, expiry cron

---

## 0.3.0 — Dream approve + world timeline (2026-07-21)

Human review gate before L2 writes; L1 mem pool cleared by event-id scope; memory-chain uses occurrence days.

### Added

- **`GET /dream/pending`**, **`POST /dream/approve`**, **`POST /dream/discard`**
- **L1.5 draft staging** — `dream/draft/{run_id}/` + `manifest.yaml`; `dream/runs/{id}.yaml`; reports under `dream/reports/`
- **L1 mem pool** — `short-term-memory/pool.jsonl` indexed by L0 event id; approve clears only frozen scope **S**
- **`pending_review`** status; ingest allowed while pending (blocked only under dream lock)
- **Supersede** — new `/dream/run` replaces the unique pending
- **World timeline** — `chain.id` = occurrence day; approve blocks future `chain.id` (`409 future_chain_id`)
- **`propose_node` → live node** on approve (same-run create + semantic allowed)
- Consolidate **minimal UI** — Extract / report / Approve / Discard
- Empty patches may pending; approve clears S with no L2 write

### Changed

- `POST /dream/run` = extract + materialize only (no auto-apply / no resume-apply)
- Extract input = full scope S (cross-day L0), not “today only”
- `/status` exposes `dream_pending`, `l1_clear_pending`, job `phase`

### Removed / cancelled

- Per-patch live apply as the main path; resume-apply of unapplied patches
- Candidates-as-create-node gate (attribution candidates remain for low-confidence episodic)

### Out of scope

- Node merge, full review UI, L1 capacity/forgetting
- Future-sight → moved to **0.4.0** (shipped)

---

## 0.2.0 — Web UI (2026-07-18)

Browser workbench for the 0.1.0 memory loop: **Capture → Consolidate → Recall**, without changing the memory contract.

### Added

- **`web/`** — vanilla HTML/CSS/JS workbench UI on Bun (`:8788`)
- **API proxy** — `/api/*` → `ENGRAM_URL` (default `http://localhost:8787`)
- **Capture** — textarea ingest (`source: web`), optional `node_refs`, today's L1 panel; disabled while dream lock held
- **Consolidate** — status panel + Run dream; shows applied / DLQ / resumed / 502 incomplete
- **Recall** — activate query with L1 → day chain → nodes reading layout
- **Status light** — polls `/status`; maps `lock` → dreaming

### Out of scope (unchanged)

- Auth, candidates approve UI, DLQ settlement, streaming dream logs, embeddings / graph

---

## 0.1.0 — Prototype (2026-07-18)

First runnable memory loop: **ingest → dream (extract + apply) → activate**, over a Bun HTTP API and file-backed store.

### Added

- **Bun HTTP server** (`server/`) with `ENGRAM_HOME` store layout and Asia/Taipei timestamps
- **`POST /ingest`** — append L0 event + update L1 (`today-summary`, optional node notes); rejects with `409` while dream lock held
- **`POST /dream/run`** — lock → Claude Code extract → L1.5 patches → apply → clear L1; resume apply-only when patches exist and L1 still present
- **`GET /activate`** — activation packet: L1, day chain, matched L2 `what` Current (optional `?q=`)
- **`GET /status`** — lock, L1 empty, DLQ count, `dream_status`
- **Apply mechanical layer** — patch schema, per-patch idempotency (`applied.yaml`), DLQ for failed patches, clear L1 after apply pass
- **Patch types (prototype):** `semantic/what`, `chain/day`, `propose_node`; low-confidence `episodic` → attribution candidates; high-confidence episodic not applied yet
- **AgentRunner** — `ClaudeCodeRunner` (headless `claude -p`) plus `mock-ok` / `mock-fail` for tests
- **CLI** — `reset`, `fixture:apply`, `test:phases`
- **API docs** — `api-docs/`
- **Workbench skill** — `.claude/skills/engram-workbench` (HTTP-only control plane)

### Out of scope (prototype)

- Web / chat UI
- DLQ settlement / adhoc review API
- Candidate approve → create `nodes/{id}/` via API
- Chronology apply, week/month chain, graph links, embedding, scheduled dream
- Multi-tenant / auth

### Notes

- Validates the MVP question: ≤3 nodes + L0 + L1 + dream run (what + day + candidates + L1.5) vs full rewrite
- Clients and skills must use the HTTP API; do not edit `ENGRAM_HOME` for operational writes
