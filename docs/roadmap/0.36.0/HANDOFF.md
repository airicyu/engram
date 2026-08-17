# Handoff — Implement Engram 0.36.0

**To:** implementing agent (no prior chat context required)  
**From:** planning session (2026-08-17)  
**Product repo:** Engram (`AGENTS.md` at repo root)  
**Language with user:** 繁體中文書面語（見 `AGENTS.md`）

---

## Your mission

Ship **0.36.0** Workbench UI only:

1. **殼** — 左欄四項（事件／搜索／提問郵箱／記憶）＋右欄；廢 Topbar 橫向場景 tab  
2. **事件** — Twitter 式發帖＋近期 STM 帖＋沉澱 tab  
3. **提問郵箱** — 釐清改 DM 式  

**搜索、記憶內頁不改功能**（只掛左欄）。**不**改 HTTP／store／dream。記憶鏈／graph **不做**（parked）。

**Do not invent scope.** [`INDEX.md`](./INDEX.md) + [`docs/ia.md`](./docs/ia.md) are the sole source of truth.

---

## Read first (in order) — then implement

1. [`AGENTS.md`](../../../AGENTS.md)  
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md)  
3. [`docs/roadmap/agent-workflow.md`](../agent-workflow.md)  
4. **[`docs/roadmap/0.36.0/INDEX.md`](./INDEX.md)**  
5. [`docs/ia.md`](./docs/ia.md)  
6. [`docs/reasoning.md`](./docs/reasoning.md) — 僅歧義時；衝突時 INDEX 勝  

---

## One-paragraph product summary

Replace the top scene tabs with a left nav: Events, Search, Inbox, Memory. Hash paths stay 0.31 (`#/activities`, `#/consolidate`, `#/seek`, `#/clarify`, `#/memory…`). Events page: compose at top (image widget, Post bottom-right), then tabs Recent (`GET /memories/short-term-memory` `entries[]` as cards) and Consolidate (existing dream review). Seek and Memory scenes keep current inner UI. Clarify becomes a DM inbox (same APIs).

---

## Suggested implementation order

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **1 殼** | layout、左欄、hash 高亮、`#/consolidate`→事件＋沉澱 tab |
| 2 | **2 事件** | 發帖卡、STM 帖、搬 Consolidate |
| 3 | **3 郵箱** | Clarify DM |
| 4 | **出貨文件** | `version.md`／changelog／AGENTS／domain-language UI 循環；INDEX → shipped |

開工時把 INDEX 狀態改為 **`in progress`**。

**Testing：** 本版以 UI 為主；全部結束仍跑 **`bun run test:phases`**（勿改壞 API）。手驗四欄 hash。勿 commit unless the user asks.

---

## Critical invariants

1. **不**改 SceneId 集合；**不**改 hash path 字串。
2. 左欄「事件」在 `activities` **與** `consolidate` 都為選中。
3. Seek／Memory **內頁邏輯與版面等價** 0.35（除外殼）。
4. STM 用 `entries[]`；**不要**再讀 `summary`／`node_notes`。
5. Clarify／dream／activities **API 不變**；aside 不是 activity。
6. **不要**做記憶鏈橫向或 node graph。
7. **有** store migrate `0.28→0.36`；boot gate ≥0.36。
8. 對使用者繁中書面語。

---

## Anchor code

| Path | Why |
|------|-----|
| `web/src/App.tsx` | 場景 |
| `web/src/components/Topbar.tsx` | 現橫向 tab（應拆成 sidebar） |
| `web/src/lib/hashRoute.ts` | hash |
| `web/src/scenes/ActivitiesScene.tsx` | 發帖＋STM |
| `web/src/scenes/ConsolidateScene.tsx` | 沉澱 |
| `web/src/scenes/ClarifyScene.tsx` | 釐清 |
| `web/src/scenes/SeekScene.tsx` | 搜索（勿改內頁） |
| `web/src/scenes/MemoryScene.tsx` | 記憶（勿改內頁） |
| `web/src/i18n/*.json` | 左欄文案 |
| `web/src/styles/app.css` | 佈局 |

---

## Done checklist

- [x] INDEX 驗收全勾；status → `shipped`
- [x] version／changelog／AGENTS／domain-language
- [x] `bun run test:phases` 綠
- [ ] **Do not commit unless the user asks**

---

## Paste-ready starter prompt

```text
你是 Engram 0.36.0 實作 agent。只認檔案，不認 chat history。
對使用者用繁體中文書面語（AGENTS.md）。

先讀（依序）：
AGENTS.md → docs/roadmap/0.36.0/HANDOFF.md → INDEX.md → docs/ia.md
（有歧義再讀 docs/reasoning.md；衝突時 INDEX 勝）。

任務：左欄四項殼＋事件 Twitter 式（發帖／近期 entries 帖／沉澱 tab）＋釐清改 DM。
搜索與記憶內頁不改。不改 API／store／dream。不做記憶鏈／graph。
跟 Track 1→2→3；禁非目標。
全部結束跑 bun run test:phases（server 目錄）。
Do not commit unless the user asks.
開始前把 INDEX 狀態改為 in progress。
```
