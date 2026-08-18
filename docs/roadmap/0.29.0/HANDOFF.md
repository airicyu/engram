# Handoff — Implement Engram 0.29.0

**To:** implementing agent (no prior chat context required)  
**From:** planning session (2026-08-09／10)  
**Product repo:** Engram (`AGENTS.md` at repo root)  
**Language with user:** 繁體中文書面語（見 `AGENTS.md`）

---

## Your mission

Ship **0.29.0**: **Activity media attachments** only — tmp upload, Activities compose UX, submit move＋heading-block appendix, symmetric embed validation, tmp housekeep, dream／STM prompts that teach reading／writing the same `![[…]]` embeds **without** requiring vision.

**Do not invent scope.** [`INDEX.md`](./INDEX.md) + linked docs are the sole source of truth. Chat history does not exist for you. **No** graph, vector search, reflective prompts, reuse-existing-attachments, WYSIWYG, or HEIC.

---

## Read first (in order) — then implement

1. [`AGENTS.md`](../../../AGENTS.md) — ops boundaries (HTTP API for memory state; language)
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md) — roadmap self-sufficiency
3. **[`docs/roadmap/0.29.0/INDEX.md`](./INDEX.md)** — WHAT / 已定案 #1–#45 / non-goals / tracks / 驗收
4. [`docs/capture-and-appendix.md`](./docs/capture-and-appendix.md) — paths, API shapes, validation, appendix render
5. [`docs/reasoning.md`](./docs/reasoning.md) — WHY (only if a decision feels ambiguous)
6. Optional historiography: [`docs/design-review.md`](./docs/design-review.md)（已併入 INDEX；衝突時 **INDEX 勝**）

---

## One-paragraph product summary

- Activities: markdown **textarea** (raw trim 非空) + **media attachments** (per-item required short **relationship**).
- Drag／paste／paperclip → `POST /attachments/uploads` (`file`) → file in **`uploads/tmp/{day}/`**; insert exact `![[_attachments/uploads/{day}/{name}]]` at cursor (never `/tmp` in embed).
- Submit `POST /activities` with body raw (**no** appendix yet) + `attachments[{path,relationship}]` → validate → move tmp→formal → **server** appends `## Attachment relationships` appendix → L0＋STM final `raw`.
- Symmetric set equality; exact `![[path]]` only; duplicate paths／path traversal／double appendix → 400.
- MIME jpeg/png/webp/gif; max bytes configurable default 10MiB; **no** per-activity count cap; **no** HEIC.
- Housekeep **only** tmp by **directory day** vs clock (default 2 days). Auto-gitignore tmp on ensure. **No** per-activity git commit (approve commits as today).
- Dream prompts teach appendix + same embeds; AI may omit on rollups; **no** vision requirement; **no** mechanical ledger force-embed.
- **No** store migrate hop; boot still ≥0.28.

---

## Suggested implementation order

Follow INDEX tracks **A → D**:

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **A** | `_attachments` ensure＋gitignore；upload／delete-tmp APIs；extend activities（validate／move／rollback／appendix／Event.attachments）；housekeep；config keys；unit tests |
| 2 | **B** | `ActivitiesScene`：media attachments UI、drag／paste／＋、cursor insert、i18n、error display |
| 3 | **C** | `dream-files.md`（＋必要 extract／STM 說明）：Attachment relationships、embed、選材可取捨、勿 vision |
| 4 | **D** | api-docs、AGENTS、skills 若需、version／changelog、setup／README；INDEX → shipped；backlog 附圖列移除 |

Set INDEX status to **`in progress`** when you start.

**Testing cadence**（見 [`agent-workflow.md`](../agent-workflow.md)）：

- **After each Track:** run that Track’s unit／narrow tests（and curl／manual checks as applicable）；only then start the next Track.
- **After all Tracks:** must run **`bun run test:phases`**. Prefer a **new** agent for `docs/implementation-review.md`, then return here to fix findings and re-run phases.

Tick every **驗收** checkbox when done.

---

## Critical invariants (do not violate)

1. Embed path **never** contains `/tmp`; physical file may sit in tmp until submit.
2. **Server** owns appendix render and **filename** (conflict rename); client must not submit pre-built appendix.
3. Symmetric check uses **exact** `![[{path}]]` only (`|alias` → fail).
4. On write failure after move: non-2xx + **best-effort** move back to tmp; no compensation admin API.
5. DELETE tmp is query `?day=&filename=` and **idempotent 200**; never deletes formal uploads.
6. Upload + activities respect **dream_locked** → 409.
7. Do **not** git commit on each activity／upload; do **not** raise boot gate to 0.29; do **not** add migrate hop.
8. Do **not** build WYSIWYG, vision pipeline, reuse-existing UI, graph, or clear formal `uploads/{day}/` via housekeep.

---

## Anchor code (start grepping here)

| Path | Why |
|------|-----|
| `web/src/scenes/ActivitiesScene.tsx` | Capture UI |
| `server/src/api/activities.ts` | `POST /activities` |
| `server/src/store/memories/activities.ts` | L0 `Event` |
| `server/src/store/memories/short-term-memory.ts` | pool／summary raw |
| `server/src/config.ts` | workspace／env pattern for new keys |
| `server/src/store/dreams/cleanup.ts`／`cli/dreams-cleanup.ts` | TTL／cleanup pattern |
| `server/src/dream/review/approve.ts` | when store git commits |
| `server/src/index.ts`（或 routes 註冊處） | wire new attachment routes |
| `server/prompts/dream-files.md` | dream write rules |
| `docs/api-docs/api.md` | HTTP contract |
| `server/src/cli/self-test.ts` | extend phases for attachments |

---

## When finished

1. INDEX status → `shipped`；驗收全勾  
2. `version.md` = `0.29.0`；changelog 條目  
3. AGENTS「目前版本脈絡」：0.29 shipped；backlog 附圖列移除  
4. api.md：upload／delete-tmp／activities attachments／errors／config keys  
5. Tell the user briefly how to try: drag image on Activities, fill relationship, submit；Obsidian vault still `memories/` with `_attachments/uploads/`

**Do not commit unless the user asks.**

---

## Paste-ready starter prompt (for a new agent chat)

```text
Implement Engram 0.29.0 per the roadmap. Do not use chat history; only the files.

Read in order:
1. AGENTS.md
2. docs/roadmap/0.29.0/HANDOFF.md
3. docs/roadmap/0.29.0/INDEX.md and every doc it links (especially docs/capture-and-appendix.md)

Then set INDEX status to in progress, implement Tracks A→D. After each Track, run that Track's unit/narrow tests before continuing. After all Tracks, run bun run test:phases. Prefer a fresh agent to write docs/implementation-review.md against INDEX; then fix findings here and re-run phases. Update version/changelog/api-docs/AGENTS, mark INDEX shipped, remove activity-images from backlog INDEX.

Follow INDEX 已定案 only. No WYSIWYG, no vision, no HEIC, no migrate hop, no per-activity git commit, no reuse-existing attachments, no other backlog features.
Ask only if INDEX is silent on a decision; otherwise follow 已定案.
Respond to the user in Traditional Chinese (書面語).
```
