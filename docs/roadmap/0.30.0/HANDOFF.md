# Handoff — Implement Engram 0.30.0

**To:** implementing agent (no prior chat context required)  
**From:** planning session (2026-08-11)  
**Product repo:** Engram (`AGENTS.md` at repo root)  
**Language with user:** 繁體中文書面語（見 `AGENTS.md`）

---

## Your mission

Ship **0.30.0**: **Clarify** only — fifth scene **釐清**, store queues `memories/clarify/{asking,pending,history}/`, dream tail jobs `clarify_distill` → `clarify_generate`, distill into **draft node mains only**, approve deploys L2 and archives snapshot pending → history.

**Do not invent scope.** [`INDEX.md`](./INDEX.md) + linked docs are the sole source of truth. Chat history does not exist for you. **No** graph, vector, Seek-by-score, badge counts, migrate hop, or silent live node writes.

---

## Read first (in order) — then implement

1. [`AGENTS.md`](../../../AGENTS.md) — ops boundaries (HTTP API for memory state; language)
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md) — roadmap self-sufficiency
3. [`docs/roadmap/agent-workflow.md`](../agent-workflow.md) — Track testing / implementation-review cadence
4. **[`docs/roadmap/0.30.0/INDEX.md`](./INDEX.md)** — WHAT / 已定案 / non-goals / tracks / 驗收
5. [`docs/queues-and-pipeline.md`](./docs/queues-and-pipeline.md) — paths, frontmatter, HTTP, pipeline hooks, approve archive
6. [`docs/reasoning.md`](./docs/reasoning.md) — WHY (only if a decision feels ambiguous)
7. Optional historiography: [`docs/design-review.md`](./docs/design-review.md)（已併入 INDEX；衝突時 **INDEX 勝**）  
   早期 backlog「反思補問」已刪；產品真相以本版 INDEX 為準。

---

## One-paragraph product summary

- Fifth tab **Clarify／釐清**（Topbar：activities → consolidate → **clarify** → seek → memory；**no** badge）.
- Queues under `memories/clarify/`：asking（question only）→ submit moves to pending（Q+A）；aside writes pending `kind: aside`；history＝approve backup only.
- Not activities：no L0／STM／day ledger.
- Dream tail：after rollup／involvements → snapshot pending ids into **`DreamRunState.clarify_pending_snapshot_ids`** → **distill**（draft nodes only, may create）→ finalizeDraft → **generate**（server writes live asking＋git commit； agent must **not** get live `memories/**` writable）→ report `## Clarify distill` → `pending_review`.
- Approve：deploy as today；**even if** `empty_patches`, archive snapshot∩pending → history；deploy fail → no move.
- Discard／Amend：**never** delete asking／pending；Amend does **not** re-run clarify.
- Retry：before re-generate, **delete** asking whose `source_dream_run_id` is the discarded／superseded run id(s)；then full pipeline.
- No migrate hop；`ensureClarifyDirs`；boot still ≥0.28.

---

## Suggested implementation order

Follow INDEX tracks **A → C**:

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **A** | ensure dirs；file schema＋API；pipeline jobs；DreamRunState snapshot；approve archive（empty_patches）；retry clear asking；report＋`draft_summary.clarify_distilled_node_ids`；unit／narrow tests listed in INDEX Track A |
| 2 | **B** | `SceneId`＋Topbar＋i18n；ClarifyScene（cards＋aside）；Consolidate shows Clarify distill（optional highlight ids） |
| 3 | **C** | api-docs、AGENTS、domain-language、workbench skill、version／changelog；INDEX → shipped；delete backlog reflective-prompts row／file；`test:phases` |

Set INDEX status to **`in progress`** when you start.

**Testing cadence**（見 [`agent-workflow.md`](../agent-workflow.md)）：

- **After each Track:** run that Track’s unit／narrow tests；only then start the next Track.
- **After all Tracks:** must run **`bun run test:phases`**. Prefer a **new** agent for `docs/implementation-review.md`, then return here to fix findings and re-run phases.

Tick every **驗收** checkbox when done.

---

## Critical invariants (do not violate)

1. Distill writes **only** draft `memories/nodes/{id}/{id}.md`（create allowed）；never chain／future-sight／ledger.
2. Generate＝**server** land＋commit；**never** add live `memories/clarify`（or broader live `memories/**`）to dream agent `writableRoots`.
3. Snapshot truth＝`DreamRunState.clarify_pending_snapshot_ids`；not report markdown alone.
4. Approve archives snapshot even when `empty_patches`；never archive on failed deploy；`l1_clear_pending` does **not** re-archive.
5. Retry clears same-cycle asking by `source_dream_run_id` before generate；pending queue stays.
6. Discard／Amend must **not** delete asking.
7. dream lock → clarify writes **409** `dream_locked`；`pending_review` **allows** clarify writes.
8. No migrate hop；do **not** raise boot gate above 0.28 requirement.
9. Hard clarify job failure → whole dream fails with phase **`materialize`**；whitelist violations＝strip＋log, not whole-dream fail.
10. Do **not** build badge, list-pending HTTP, asking TTL／history GC, or silent live L2 writes.

---

## Anchor code (start grepping here)

| Path | Why |
|------|-----|
| `server/src/dream/execute/pipeline.ts` | Hang clarify jobs before pending_review |
| `server/src/store/dreams/file-pipeline.ts` | Draft finalize／manifest |
| `server/src/dream/review/approve.ts` | Deploy＋archive hook；empty_patches |
| `server/src/dream/report/finalize.ts` | Report section order＋narrative truncate |
| `server/src/agent/shared/write-policy.ts` | Must stay draft＋reports for distill；generate not via this fence |
| `server/src/api/` + `server/src/index.ts` | Register `/memories/clarify/*` |
| `web/src/App.tsx`／`Topbar.tsx`／`lib/types.ts` | Fifth scene |
| `web/src/scenes/ConsolidateScene.tsx` | Pending report display |

---

## Done checklist

- [ ] INDEX 驗收全勾；status → `shipped`（僅在 phases 綠＋無未關 HIGH 實作審查後）
- [ ] `version.md`／`changelog.md`／`docs/api-docs/`／`AGENTS.md`／`docs/domain-language.md`／workbench skill 同步
- [ ] backlog `reflective-cognition-prompts` 列／檔出貨後刪除
- [ ] `bun run test:phases` 綠
- [ ] **Do not commit unless the user asks**

---

## Paste-ready starter prompt

```text
你是 Engram 0.30.0 實作 agent。只認檔案，不認 chat history。
對使用者用繁體中文書面語（AGENTS.md）。

先讀（依序）：
AGENTS.md → docs/roadmap/0.30.0/HANDOFF.md → INDEX.md → docs/queues-and-pipeline.md
（有歧義再讀 reasoning／design-review；衝突時 INDEX 勝）。

任務：實作 Clarified 釐清（第五場景＋三 queue＋clarify_distill／clarify_generate）。
跟 Track A→B→C；禁非目標；INDEX 沉默才提問，否則跟已定案。
每 Track 結束跑該 Track 窄測；全部結束跑 bun run test:phases。
Do not commit unless the user asks.
開始前把 INDEX 狀態改為 in progress。
```
