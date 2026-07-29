# Changelog

## 0.17.0 — 未來視雙區（hot／later）＋入夢前機械維護 (2026-07-29)

未來視由一錨一檔改為 **`hot.md`／`later.md` 兩整檔**；入夢前純 script 過期／出窗／重桶並 git commit；入夢 AI 維護內容後同一人審 deploy。舊 backlog「mindzone」語意＝hot 區，不另開記憶層。

### Added

- Config：`future_sight_window_days`（預設 90）、`future_sight_hot_days`（預設 30）；優先序 **workspace → 否則 env → 預設**（同 timezone）
- `maintainFutureSight`：入夢前 full＋commit；`GET /memories/future-sight` expire-only＋commit；approve 前對 draft full maintain
- Status：`future_sight_hot_count`／`future_sight_later_count`（保留 `future_sight_active_count`＝總數）
- GET 錨點帶 `zone: hot|later`；先 hot 再 later
- Migration：`.claude/skills/engram-migration/migrate-0.16-to-0.17.md`＋腳本

### Changed

- 存法：`memories/future-sight/hot.md`＋`later.md`；廢 `active/{id}.md`
- Item 格式：`## {id}`＋yaml fence（**僅** `anchor_start`／`anchor_end`）＋正文；排序近→遠；**不**存 `node_refs`／`event_refs`／`dream_run_id`／`committed_at`
- 過期與出窗 event 同 `source: system/future_sight_expired`，以 `ingest_meta.reason` 區分
- Dream prompt 強制對照兩檔做內容加減改
- Discard **不**回滾入夢前維護 commit
### Non-goals

- Seek／ask 注入未來視；獨立 mindzone；日曆／待辦 UI；強制 `hot_days < window_days`

### Migrate

- 0.16 store → 見 `.claude/skills/engram-migration/migrate-0.16-to-0.17.md`

---

## 0.16.0 — Store git 事務 ＋ 入夢改 draft 檔案作業 (2026-07-29)

記憶庫以 **local git** 做 approve 事務與歷史；入夢改為 **一套 prompt → AI 直接改 draft 檔**；廢 typed JSON patch 驅動的 extract→materialize；報告改固定結構 narrative；day summary／node `what.md` 廢 `## Current`／`## History`。

### Added

- Store **必備 git**：`ensureEngramHome` 幂等 `git init`／`.gitignore`（`tmp/`、`dreams/`、`log/`）／初始 commit；無 git → 拒絕啟動；`GET /status.store_git`
- **`ENGRAM_TEMP_DIR`**（預設 `/tmp`）：ask job 與 dream agent disposable workdir；不再寫入記憶庫 `tmp/ask/`（store `tmp/` 僅留 `clock.json` 等）
- Approve：**deletes → deploy → `git commit`**（message 含 `dream_run_id`）；失敗只還原 touched paths（禁止整庫 `reset --hard`）
- 入夢 file pipeline：`AgentRunner.dream`、`dreams/draft/{run_id}/`、ledger append sidecar、`deletes.txt`、協定 report（server 校對 Appendix）
- Migration skill：`.claude/skills/engram-migration/`（含 `migrate-0.15-to-0.16` 機械腳本）

### Changed

- Pending：以 **report＋`draft_summary`** 為主（不再回 typed `patches` 陣列）
- Day summary／`what.md`：整檔＝最新敘事；day ledger：無檔頂 `# 日期`，保留 patch metadata
- Rollup：寫入同一 draft，不再走 typed patch materialize
- Consolidate UI：展示 report；去掉 patch 計數
- Ask／dream temp：統一走 `ENGRAM_TEMP_DIR`（dream 結束後清 disposable dir；ask 仍 prune 保留最近 N 筆）
- **Week chain id**：`YYYY-Www` → **`YYYY-Www-MMDD`**（`MMDD`＝ISO 週一）；`GET /memories/chain/weeks`（及 detail）回 `start`／`end`（Mon–Sun 完整日期）；Memory UI 展示區間
- **`store_version`**：寫在 `engram.workspace.yaml`；`GET /status` 回 `store_version`＋`product_version`；缺鍵不拒啟；migrate／新建 store 才 stamp

### Removed（主路徑）

- Typed `Patch[]` → `materializeDraft` 作為入夢驅動（`patches.jsonl` 可留考古，不再寫入驅動）

### Non-goals

- 遠端 GitHub 同步；入夢直寫 live；Mindzone／node merge／DLQ UI

### Migrate

- 0.15 store → 見 `.claude/skills/engram-migration/migrate-0.15-to-0.16.md`（含 week 檔名升級為 `YYYY-Www-MMDD`）
- 已是 0.16 但 week 仍為舊 `YYYY-Www`：重跑同腳本之 week rename（幂等），或見 [`docs/roadmap/0.16.0/docs/week-id-mmdd.md`](./docs/roadmap/0.16.0/docs/week-id-mmdd.md)

---

## 0.15.0 — Server src layout + agent shared runners (2026-07-27)

Internal refactor: align `server/src` with product domains, share agent subprocess helpers, and retire **L1／L1.5** as current terminology（→ **short-term memory**／**dream staging**）. **HTTP paths and JSON wire keys unchanged**（含 `scope=l1`、`l1_empty`）.

### Changed

- **`store/`** 分組鏡像磁碟：`memories/`／`dreams/`／`tmp/`；`events`→`activities`；`l1`→`short-term-memory`
- **`api/`／業務編排**：Seek → `seek/`＋`api/seek/`；Activities short-term preview；`capture`→`activities`
- **Agent**：共用 `subprocess`／`temp-context`／`prompt-template`／envelope helper；Claude extract 與 rollup 納入 process registry（cancel 可殺 child）
- **Prompts**：`rollup-plan.md` 單一檔（原 week／month／year 三份相同內容合併）；**rollup-write week／month／year**：外層仍按 lived dimensions 分 `##`，**節內改為時間線敘事**（禁止無指涉的「這天／今日」）
- **文件用語**：`domain-language`／`CLAUDE.md`／api-docs／README／workbench skill 對齊 short-term memory／dream staging

### Non-goals

- HTTP URL／JSON 欄位改名；記憶庫磁碟再搬；agent timeout；新記憶功能

---

## 0.14.0 — Store Layout Refactor (2026-07-27)

Reorganize the memory store layout and hard-cut HTTP base paths to match（未對外開放，無舊 path／env alias）.

### Changed

- Live memory under `memories/`；dream pipeline under `dreams/`；ask／clock under `tmp/`
- HTTP：**`POST /activities`**；**`/dreams/*`**；**`/memories/*`**（含 **`GET /memories/future-sight`**、**`GET /memories/short-term-memory`**）
- Disk chain：**`memories/chain/`**（不再 `memories/memory-chain/`）
- Env／status：**`ENGRAM_STORE_DIR`**（取代 `ENGRAM_HOME`）；**`GET /status.store_dir`**（取代 `engram_home`）
- HTTP listen：**API／UI／Vite 固定綁 `127.0.0.1`**（本機 `localhost` 可存取；不對 LAN 開放）
- Removed unused scaffolding：`meta.yaml`、`meta/`、`archive/`、empty dream reviews／dlq-archive、`applied.yaml`、`candidates/nodes.yaml`

### Non-goals

- New memory features；long dual-read of old disk／URL／env names

---

## 0.13.0 — Workspace Config + First-run Setup (2026-07-26)

Per-`ENGRAM_STORE_DIR` preferences plus a first-run setup wizard.

### Added

- **`{ENGRAM_STORE_DIR}/engram.workspace.yaml`** — optional `timezone` (IANA) + `memory_language` (`zh-Hant`｜`zh-Hans`｜`en`); unknown keys／invalid values → server refuses to start
- **Effective language priority:** workspace → `ENGRAM_MEMORY_LANGUAGE` → **`en`**
- **`GET /status.memory_language`** — always one of the three codes
- Prompt injection `{{MEMORY_LANGUAGE}}` for extract／rollup／memory-ask (new prose only; L0 untouched)
- **`bun run setup`** — `setup-wizard/` mini Bun server (random port, console URL, open browser); writes `server/.env`、`web/.env`、data home、workspace yaml; overwrite requires confirm (`409` then `overwrite: true`)

### Changed

- Timezone resolution: workspace overlay on `ENGRAM_TZ`／default `Asia/Hong_Kong`
- Default memory write language is explicit **`en`** when unset (intentional vs 0.12 unconstrained)

### Non-goals

- Runtime workspace settings API／Workbench settings page／hot reload
- Bare UTC offset as timezone; rewriting old L2／L0

---

## 0.12.0 — Dream Retry with Reason (2026-07-26)

Pending review is three-way only: **Approve／Discard／Retry with reason**. No more unreasoned Dream (replace).

### Added

- **`POST /dream/retry`** — `{ reason }` required; optional `dream_run_id`
- Snapshot previous draft／patches summary + frozen **scope S** → discard pending → new run on **same S** with `review_feedback` in extract context
- Report／run yaml audit: `retried_from`, `retry_reason`
- Consolidate UI: reason field + **Retry with reason**

### Changed

- `pending_review` → **`POST /dream/run` 409** `pending_review` (supersede removed)
- Extract prompt documents `review_feedback` for retries

### Removed

- UI「入夢（取代）／Dream (replace)」

### Non-goals

- Hand-edit patches／draft; multi-turn chat revise UI; Cancel semantics unchanged

---

## 0.11.0 — Week／Month／Year Memory Chain (2026-07-26)

Higher-granularity memory chain on top of day: summary-only week／month／year with planner→writer cascade inside the same dream pending review.

### Added

- **Day path grouping** — `memory-chain/days/{YYYY-MM}/{day}.md` (+ `.summary.md`)
- **Week／month／year summaries** — store layout + `initialized_{weeks,months,years}.yaml` (initialized ≠ freeze)
- **Rollup pipeline** — after day extract／materialize: week → month → year planner（Y/N）then writer → same draft／`patches.jsonl` (`level` extended)
- **Browse API** — `GET /memory/chain/weeks|months|years` (+ `/{id}`); empty → `200` + `present: false`
- **Search** — chain hits include `level` (+ `id`; day keeps `day_id`)
- **Web Memory** — Day｜Week｜Month｜Year chain browse
- **`bun run chain:backfill`** — engineering backfill of higher summaries from day chain

### Changed

- Dream report lists higher-chain rollup decisions／init／revise
- `memory-ask` prompt paths for grouped days + higher summaries
- MVP “closed = freeze” superseded by **initialized + revisable** rollup
- **Rollup writer** — prompts ask for multi-paragraph fused summary; mock／pipeline do **not** mid-cut with `…` (trust agent length judgment)
- **Higher summaries** — week／month／year keep **latest snapshot only** (whole file = markdown body; no `## Current`／`## History` wrapper)
- **Month／year writer** — organize by **life dimensions** with short content-derived `##` section titles (not a fixed Work／Family checklist; not calendar-linear tour); week may stay lightly chronological but still sectioned
- **Day chain `summary`** — may use the same `##` section titles inside Current; store still wraps `## Current`／`## History`
### Non-goals (unchanged)

- No git store transactions; no higher-level ledgers; no cron scheduler

---

## 0.10.0 — Web Vite + React (2026-07-25)

Workbench UI rewritten as Vite + React + TypeScript; shared AppShell width for all scenes.

### Changed

- **`web/`** — Vite + React + TS; scenes as components under `src/scenes/`
- **AppShell** — fixed width `min(80rem, …)` for every scene (topbar + content)
- **Dev** — `bun run dev` → Vite on `:8788` with `/api` proxy
- **Prod** — `bun run build` → `dist/`; `bun run start` serves dist + API proxy

### Removed

- Vanilla `app.js` / root `index.html` multi-section page / Bun HTML import serve path

### Unchanged

- Engram server HTTP API contracts
- Scene set: Capture → Consolidate → Seek → Memory
- i18n zh-Hant／en catalogs

---

## 0.9.0 — Time Replay (2026-07-24)

Virtual memory clock + day-by-day fixture replay (capture → dream → approve).

### Added

- **Virtual clock** — `nowIso()` / `calendarDate()` read a settable timeline; persist `ENGRAM_STORE_DIR/meta/clock.json`
- **`GET /clock`** / **`PUT /clock`** / **`DELETE /clock`** — inspect / set / clear virtual now (`PUT` requires `ENGRAM_ALLOW_VIRTUAL_CLOCK=1`)
- **`/status.clock`** — `{ mode, now, today, timezone, allow_set }`
- Extract context + prompts: explicit **`today`** / **`now`** (also memory-ask)
- **`bun run replay`** — fixture JSONL orchestrator (per-day capture → dream night → auto-approve; `--pause` optional)
- Sample fixture: `server/fixtures/replay-sample.jsonl`
- `test:phases` Phase 6 virtual-clock assertions

### Unchanged

- Capture body still has no client `ts` — set clock first, then `POST /capture`
- Seek / Memory browse contracts

---

## 0.8.0 — Seek + Memory Browse (2026-07-24)

Split **Seek** (search／ask) from **Memory** (browse); add read-only chain／nodes browse API.

### Added

- **`GET /memory/chain`** — day index (new→old + 80-char preview)
- **`GET /memory/chain/{day_id}`** — day detail (`summary` or `ledger_fallback`)
- **`GET /memory/nodes`** — L2 node index (A→Z + preview)
- **`GET /memory/nodes/{node_id}`** — what Current detail
- Workbench **四場景**：記下／沉澱／**尋找 Seek**／**記憶 Memory**
- Memory browse UI — chain + nodes split layout (`≥48rem`); client-side node filter
- `test:phases` Phase 4c browse assertions

### Changed

- UI **Search + Ask** moved to **Seek** scene; API paths unchanged
- Memory scene width `min(56rem, …)`; other scenes stay `42rem`

### Unchanged

- **`GET /memory/search`**、**`POST /memory/ask`** contracts
- L1 preview stays on **Capture** (`GET /memory/l1`)
- No future-sight browse; no server-side node filter

---

## 0.7.0 — Memory + Ask + Dream Cancel (2026-07-23)

Rename Recall → **Memory**; keyword search with optional **scope**; async AI ask; manual dream/ask cancel.

### Added

- **`GET /memory/l1`** — Capture L1 preview (summary + node_notes only)
- **`GET /memory/search?q=&scope=`** — keyword hits only (`q` required; `scope=l1,nodes,chain` optional, default all)
- **`POST /memory/ask`** + **`GET /memory/ask/{job_id}`** + **`POST /memory/ask/{job_id}/cancel`** — async AI Q&A (`ENGRAM_AGENT=mock-ask-ok` for tests); agent reads `ENGRAM_STORE_DIR` directly
- **`POST /dream/cancel`** — cancel running dream (kill agent + revert L1.5 draft)
- **`/status` `ask_job`** — running ask summary + `log_tail`
- Workbench **Memory** scene (Search with scope checkboxes | Ask); Consolidate **Cancel** during dream

### Changed

- Product cycle UI: **Capture → Consolidate → Memory**（記憶）
- **`GET /recall` removed** (hard cut); search no longer returns activation packet / `dream_status`
- **`dream_run_id` / ask `job_id`** — compact `{prefix}-YYYYMMDD-HHmmss-{rand6}` (URL-safe); timestamps in yaml remain full ISO
- `dream-job.yaml` records **`agent_pid`** on extract spawn

### Unchanged

- No auto timeout; stale dream lock (30 min) unchanged
- `GET /future-sight` path unchanged; no future-sight UI

---

## 0.6.0 — Dream observability (2026-07-23)

Structured dream run events + default server console visibility; Workbench Consolidate progress panel.

### Added

- **`dream/runs/{dream_run_id}/events.jsonl`** — append-only structured run log (`run_start`, `agent_spawn`, `materialize_patch`, …)
- **`GET /dream/events?run_id=&after=`** — incremental event poll; `200` + empty when no file (not 404)
- **`/status` `dream_job.log_tail`** — last ≤20 events while job `running`
- Workbench Consolidate **progress panel** (phase, elapsed, scrollable log); lock poll **3s**

### Changed

- Agent spawn／finish／parse milestones **default to info** console (`logDream`); full stdout preview still `ENGRAM_DREAM_DEBUG=1`
- `dream-job.yaml` **phase updates to `materialize`** when extract finishes
- i18n keys for dream log events (`consolidate.log.*`)

### Unchanged

- Dream lock／approve／discard contract; no WebSocket／SSE

---

## 0.5.0 — Chain dual-track + Web i18n + cleanup (2026-07-22)

Memory-chain **ledger + summary** dual-track; workbench UI English／繁體中文 shell i18n; server cleanup（timezone、hot-path I/O、deps、event id）。

### Added

- **Chain summary** — `memory-chain/days/{id}.summary.md` (`## Current` / `## History`); `chain` patch fields `summary` + `summary_operation` (`init`｜`revise`)
- Extract context **`chain_summaries_current`** (+ optional `chain_ledgers`)
- Recall `chain.source`: `summary`｜`ledger_fallback`｜`empty` (prefer summary Current)
- Pending `draft_summary.chain_summary_days`
- Web **`i18n/`** — `zh-Hant`（預設）＋ `en`；topbar 語言切換；記憶內容不翻
- **`ENGRAM_TZ`**（IANA）；`/status` 欄位 **`timezone`**；extract prompt `{{TIMEZONE}}`
- `server/src/yaml.ts` — Bun 內建 YAML wrapper

### Changed

- Ledger remains `days/{id}.md` append-only; one `chain` patch drives both tracks
- Dream report timeline shows summary first; ledger increment in `<details>`
- Mock agent／`test:phases` cover dual-track
- Timezone helpers：`calendarDate`／`nowIso`（取代 `taipeiDate`／`taipeiNowIso`）；預設 **`Asia/Hong_Kong`**
- **Event id** 寬度：`e` + **10** 位（例 `e0000000001`）；`nextEventId` 以 `wc -l` 計行，不整檔 parse JSONL
- 熱路徑：DLQ count／L1 empty → `wc -l`；`patchesForRun` → `grep -F`；dream extract 事件來自 L1 scope（避免掃巨大 L0）
- 依賴：移除 npm **`yaml`**；TypeScript **~7**；`tsconfig` 去掉 deprecated `baseUrl`／`paths`
- Web status poll：lock **5s**／pending **20s**／idle **60s**
- 產品中文用語：Capture→**記下**、Consolidate→**沉澱**、Recall→**回憶**、Dream→**入夢**（`docs/domain-language.md`）
- Server 模組／主要 export 補責任註解

### Removed

- **`fixture:apply` CLI** 與 `server/fixtures/` — 機械回歸改以 `test:phases` 為主
- Hardcoded **Asia/Taipei** in runtime helpers（改為 `ENGRAM_TZ`）

### Unchanged

- No week/month rollup; no memory-content translation; no commit-time AI re-fuse
- Recall still does **not** inject future-sight

---

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

- **Bun HTTP server** (`server/`) with `ENGRAM_STORE_DIR` store layout and Asia/Taipei timestamps
- **`POST /ingest`** — append L0 event + update L1 (`today-summary`, optional node notes); rejects with `409` while dream lock held
- **`POST /dream/run`** — lock → Claude Code extract → L1.5 patches → apply → clear L1; resume apply-only when patches exist and L1 still present
- **`GET /activate`** — activation packet: L1, day chain, matched L2 `what` Current (optional `?q=`)
- **`GET /status`** — lock, L1 empty, DLQ count, `dream_status`
- **Apply mechanical layer** — patch schema, per-patch idempotency (`applied.yaml`), DLQ for failed patches, clear L1 after apply pass
- **Patch types (prototype):** `semantic/what`, `chain/day`, `propose_node`; low-confidence `episodic` → attribution candidates; high-confidence episodic not applied yet
- **AgentRunner** — `ClaudeCodeRunner` (headless `claude -p`) plus `mock-ok` / `mock-fail` for tests
- **CLI** — `reset`, `fixture:apply`, `test:phases`
- **API docs** — `docs/api-docs/`
- **Workbench skill** — `.claude/skills/engram-workbench` (HTTP-only control plane)

### Out of scope (prototype)

- Web / chat UI
- DLQ settlement / adhoc review API
- Candidate approve → create `nodes/{id}/` via API
- Chronology apply, week/month chain, graph links, embedding, scheduled dream
- Multi-tenant / auth

### Notes

- Validates the MVP question: ≤3 nodes + L0 + L1 + dream run (what + day + candidates + L1.5) vs full rewrite
- Clients and skills must use the HTTP API; do not edit `ENGRAM_STORE_DIR` for operational writes
