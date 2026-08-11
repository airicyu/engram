# Handoff — Implement Engram 0.31.0

**To:** implementing agent (no prior chat context required)  
**From:** planning session (2026-08-11)  
**Product repo:** Engram (`AGENTS.md` at repo root)  
**Language with user:** 繁體中文書面語（見 `AGENTS.md`）

---

## Your mission

Ship **0.31.0** only these three:

1. **Hash 深鏈** — scenes + Memory chain／node selection via `location.hash`
2. **MdBlock wikilink preprocess** — render P1（＋gated short）links as `#/memory/nodes/{id}`
3. **Chain write-time node wikilinks** — dream／rollup／amend prompts + mock + **summary soft lint**；**no** historical backfill

**Do not invent scope.** [`INDEX.md`](./INDEX.md) + linked docs are the sole source of truth. Chat history does not exist for you.

**Out of scope:** path router, graph GUI, vector search, chain backfill, `@` activity mentions, removing `node_refs`, node rename／merge, store migrate／boot gate bump.

---

## Read first (in order) — then implement

1. [`AGENTS.md`](../../../AGENTS.md) — ops boundaries；language
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md) — self-sufficiency
3. [`docs/roadmap/agent-workflow.md`](../agent-workflow.md) — Track testing／implementation-review
4. **[`docs/roadmap/0.31.0/INDEX.md`](./INDEX.md)** — WHAT／已定案／non-goals／tracks／驗收
5. [`docs/hash-routing-and-wikilinks.md`](./docs/hash-routing-and-wikilinks.md) — hash table、push vs replace、preprocess
6. [`docs/chain-node-wikilinks.md`](./docs/chain-node-wikilinks.md) — chain／rollup contract、non-backfill
7. [`docs/reasoning.md`](./docs/reasoning.md) — only if a decision feels ambiguous；**INDEX wins** on conflict

---

## One-paragraph product summary

Workbench URLs become shareable (`#/clarify`, `#/memory/nodes/eric`, …). Empty hash stays activities（lazy：do not auto-normalize on load）. `#/memory` alone = **chain mode** always. Scene tab changes **push** history； Memory list reselection **replace** history. `MdBlock` preprocesses `[[nodes/{id}/{id}|…]]` into markdown links to those hashes. Dream／rollup writing day／higher summaries（and ledger blocks） must P1-link nodes that exist live or are created this round； never backfill old chain when a node appears later. Soft-lint draft `*.summary.md` into Structure notes（warn only）.

---

## Suggested implementation order

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **A** | hash parse／serialize；`App`／Topbar／`MemoryScene` sync；push vs replace per INDEX |
| 2 | **B** | `preprocessNodeWikilinks` + `MdBlock`；unit tests；pass `knownNodeIds` from Memory／Seek when available |
| 3 | **C** | prompts（dream-files、rollup-write-*、amend）；mock P1 in chain；summary soft lint；`test:phases` assert |
| 4 | **D** | domain-language／AGENTS／changelog／version；INDEX → shipped |

Set INDEX status to **`in progress`** when you start.

**Testing cadence**（[`agent-workflow.md`](../agent-workflow.md)）：

- After each Track: that Track’s unit／narrow tests
- After all Tracks: **`bun run test:phases`**
- Prefer a **new** agent for `docs/implementation-review.md`, then fix findings and re-run phases

Tick every **驗收** checkbox when done.

---

## Critical invariants (do not violate)

1. Hash only — **no** History API path routes that need server fallback.
2. `#/memory` without subpath → **chain** mode（never “last mode” memory）.
3. Empty hash → activities；**do not** rewrite URL on first paint.
4. Scene navigation → **push**； in-Memory selection churn → **replace**.
5. Preprocess must not break `![[_attachments/…]]`； short `[[id]]` only if `knownNodeIds` contains id.
6. Chain P1 only for nodes existing at write time（live or this-round create）；**no** backfill job／migrate.
7. Summary soft lint **required**； ledger block lint **not** this version； lint never fails dream／approve.
8. No store migrate； boot gate stays ≥0.28.
9. Do **not** ship activity `@` mentions or delete `node_refs` in this version.

---

## Anchor code (start grepping here)

| Path | Why |
|------|-----|
| `web/src/App.tsx` | scene state |
| `web/src/components/Topbar.tsx` | scene tabs |
| `web/src/scenes/MemoryScene.tsx` | chain／nodes selection |
| `web/src/components/ui.tsx` | `MdBlock` |
| `server/prompts/dream-files.md` | day／node write rules |
| `server/prompts/rollup-write-*.md` | higher summaries |
| `server/prompts/amend-dream.md` | amend chain rules |
| `server/src/dream/report/structure-notes.ts` | soft lint（extend to summaries） |
| `server/src/store/memories/nodes.ts` | `nodeWikilink()` |
| `server/src/agent/dream/mock.ts` | phases fixtures |

---

## Done checklist

- [x] INDEX 驗收全勾；status → `shipped`（phases 綠＋無未關 HIGH 實作審查後）
- [x] `version.md`／`changelog.md`／`AGENTS.md`／`docs/domain-language.md` 同步（api-docs 僅在有行為描述需要時）
- [x] `bun run test:phases` 綠
- [ ] **Do not commit unless the user asks**

---

## Paste-ready starter prompt

```text
你是 Engram 0.31.0 實作 agent。只認檔案，不認 chat history。
對使用者用繁體中文書面語（AGENTS.md）。

先讀（依序）：
AGENTS.md → docs/roadmap/0.31.0/HANDOFF.md → INDEX.md
→ docs/hash-routing-and-wikilinks.md → docs/chain-node-wikilinks.md
（有歧義再讀 reasoning；衝突時 INDEX 勝）。

任務：hash 深鏈＋MdBlock wikilink preprocess＋chain 寫入時 P1 互指（含 summary soft lint；不做歷史 backfill）。
跟 Track A→B→C→D；禁非目標；INDEX 沉默才提問，否則跟已定案。
每 Track 結束跑窄測；全部結束跑 bun run test:phases。
Do not commit unless the user asks.
開始前把 INDEX 狀態改為 in progress。
```
