# Handoff — Implement Engram 0.37.0

**To:** implementing agent (no prior chat context required)  
**From:** planning session (2026-08-17)  
**Product repo:** Engram (`AGENTS.md` at repo root)  
**Language with user:** 繁體中文書面語（見 `AGENTS.md`）

---

## Your mission

Ship **0.37.0**：Memory **節點**模式改為 2D network graph＋`GET /memories/nodes/graph`。

**記憶鏈模式不得改行為或版面。** 橫向鏈是 backlog，不是本版。

**Do not invent scope.** [`INDEX.md`](./INDEX.md) + [`docs/graph.md`](./docs/graph.md) 是唯一真相。

**Do not commit unless the user asks.**

---

## Read first (in order) — then implement

1. [`AGENTS.md`](../../../AGENTS.md)  
2. [`docs/roadmap/GUIDELINES.md`](../GUIDELINES.md)  
3. [`docs/roadmap/agent-workflow.md`](../agent-workflow.md)  
4. **[`docs/roadmap/0.37.0/INDEX.md`](./INDEX.md)**  
5. [`docs/graph.md`](./docs/graph.md)  
6. [`docs/reasoning.md`](./docs/reasoning.md) — 僅歧義時；衝突時 INDEX 勝  

---

## One-paragraph product summary

In Memory → Nodes, replace the node list with a zoomable, draggable force-directed graph. Node size follows `display_score`; edge darkness follows reference `level` derived from P1 wikilinks inside L2 `{id}.md` only. Click a node for existing understanding detail and `#/memory/nodes/{id}`. Filter dims non-matches instead of removing them. Chain tab stays the 0.36 list.

---

## Suggested implementation order

| Order | Track | Focus |
|-------|--------|--------|
| 1 | **1 graph API** | `GET /memories/nodes/graph`＋phases |
| 2 | **2 節點圖 UI** | MemoryScene 僅 nodes 分支 |
| 3 | **3 出貨文件** | version／changelog／api.md／skill；刪 backlog graph 條 |

開工時把 INDEX 狀態改為 **`in progress`**。

**Testing：** Track 1 結束跑與 nodes／graph 相關 phases 段；全部結束必跑 **`bun run test:phases`**。手驗：鏈列表未變、節點為圖。

---

## Critical invariants

1. **不**改 `#/memory/chain/...` 與鏈 UI。
2. **不**寫 `graph/links.yaml`；**不**掃 chain md 當邊。
3. graph GET **200** 空態，**不要 404**。
4. **無** migrate hop；boot 仍 ≥0.36。
5. 對使用者繁中書面語。
6. INDEX 沉默才提問，否則跟已定案。

---

## Anchor code

| Path | Why |
|------|-----|
| `web/src/scenes/MemoryScene.tsx` | 只改 nodes 分支 |
| `web/src/lib/api.ts` | graph client |
| server nodes routes | 新 GET |
| wikilink P1 解析 | 邊 |
| `server/src/cli/self-test.ts` | phases |
| `docs/api-docs/api.md` | 契約 |

---

## Done checklist

- [ ] INDEX 驗收全勾；status → `shipped`
- [ ] version／changelog／AGENTS／api.md／workbench skill
- [ ] backlog 刪 `node-network-graph.md`；**保留** memory-chain-strip
- [ ] `bun run test:phases` 綠
- [ ] **Do not commit unless the user asks**

---

## Paste-ready starter prompt

```text
你是 Engram 0.37.0 實作 agent。只認檔案，不認 chat history。
對使用者用繁體中文書面語（AGENTS.md）。

先讀（依序）：
AGENTS.md → docs/roadmap/0.37.0/HANDOFF.md → INDEX.md → docs/graph.md
（有歧義再讀 docs/reasoning.md；衝突時 INDEX 勝）。

任務：GET /memories/nodes/graph ＋ Memory 節點模式改 2D network graph。
不要改記憶鏈 UI／API。不要寫 graph/links.yaml。無 migrate hop。
跟 Track 1→2→3；禁非目標。
全部結束跑 bun run test:phases（server 目錄）。
Do not commit unless the user asks.
開始前把 INDEX 狀態改為 in progress。
```
