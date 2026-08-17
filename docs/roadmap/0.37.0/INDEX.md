# 0.37.0 — 記憶：橫向鏈＋節點圖（parked）

← [changelog](../../../changelog.md) · 上游：[0.36.0](../0.36.0/INDEX.md)（planned）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **parked**（**不是**已排程的下一版）  
> **0.36 shipped 之後再決定**：要不要做、做鏈／做圖／或維持列表。**現在不可開工、不可當 0.36 的驗收。** 下列定案只是討論草稿，拍板後才升格為 planned。

## 產品句

> （草稿）人在記憶裡沿一條看得見的時間鏈滑動，或在節點圖上看出誰大、誰連得緊，點開才讀正文。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 定案、Track、驗收 |
| 2 | [docs/graph.md](./docs/graph.md) | 邊權重公式、filter、點選 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何不與 0.36 綁死 |

相關 backlog：[node-network-graph](../backlog/node-network-graph.md)、[記憶鏈橫向 UI](../backlog/memory-chain-strip.md)（皆未承諾）。

---

## 問題

0.36 之後記憶仍是 pills＋雙欄列表，看不出「鏈」與「網絡」。0.19 `display_score` 已可驅動大小，但沒有邊的資料。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 記憶內 tab | **記憶鏈**／**節點** 用明確 tab（底線或分段控制），**不要**現在的 mode pill 造型。hash 仍 `#/memory`、`#/memory/chain/{level}/{id}`、`#/memory/nodes/{id}`（0.31）。 |
| 2 | 鏈層級 | 日／週／月／年四個 **control button**（切 `chain` level，與現 API 相同）。 |
| 3 | 鏈視覺 | index 改為橫向 `[]-[]-[]-[]`（一格一則，新→舊或左舊右新須在 UI 標明，**定案：左＝較舊、右＝較新**，與時間軸直覺一致）。可 **指標拖曳** 橫向捲動（pointer drag on the strip，同時保留 shift+滾輪／觸控板若不難）。點一格 → 下方 **detail** 現有 GET 正文（summary 優先）。 |
| 4 | 節點圖資料 | 新增唯讀 `GET /memories/nodes/graph`（名稱固定此 path）：`{ nodes: [{ node, display_score, score }], edges: [{ a, b, refs, level }] }`。`level`＝下文公式。**不**寫 `graph/links.yaml`。計算來源＝各 L2 `{id}.md` 內 P1 wikilink `[[nodes/{id}/{id}|…]]`（**不含** chain 正文，避免與 0.31「不回填歷史」混成邊權重）。無邊則 `edges: []`。 |
| 5 | 大小 | 節點半徑／面積用 `display_score`（1–100；`null` 當最小檔）。 |
| 6 | 邊 | `refs`＝兩 id 之間 **雙向引用次數總和**（A 文提到 B 的次數＋B 文提到 A 的次數）。`refs>=1` 才有邊。`level = clamp(max(1, ceil(log2(refs))), 1, 10)`。線的顏色深淺對應 level（1 最淡、10 最深）。`log2` 為 2 為底。 |
| 7 | Filter | 保留現有節點篩選列。有 query：命中 node **highlight**，其餘 **dim**（仍畫、不可刪）。清空 query：全部 normal，無 highlight。 |
| 8 | 點選 | 點 node → **detail 面板**（overlay 或右側抽屜）：現有 `GET /memories/nodes/{id}` 的 understanding＋score。同步 hash `#/memory/nodes/{id}`。 |
| 9 | 函式庫 | 前端自選 SVG／canvas（d3-force、react-force-graph 等）；須能縮放／拖節點（佈局用）。**不要** 3D。 |
| 10 | Migrate | **無**新 hop；boot gate 仍 ≥0.36（0.36 已抬）。 |

---

## 實作軌道

### Track 1 — 鏈 tab＋橫向鏈

- 做：tab 造型、四層 control、橫拖 strip、下方 detail（沿用現 GET）。
- 不做：graph、改 chain 寫入。

### Track 2 — graph API

- 做：`GET /memories/nodes/graph`＋phases 測公式邊例。
- 不做：GUI。

### Track 3 — 節點圖 UI

- 做：圖＋filter dim＋detail。
- 不做：編輯邊、寫回 store。

---

## 非目標

- 事件／搜索／釐清再改版
- 歷史 chain wikilink backfill、vector 搜尋
- 即時編輯 graph、3D
- 抬 boot gate

---

## 錨點

| 路徑 | 用途 |
|------|------|
| `web/src/scenes/MemoryScene.tsx` | 現 pills＋列表 |
| `web/src/lib/hashRoute.ts` | memory hash |
| `GET /memories/chain*`、`GET /memories/nodes*` | 現瀏覽 |
| `server/src/store/memories/mentions.ts` 或 wikilink 解析 | P1 形 |
| `docs/roadmap/backlog/node-network-graph.md` | 舊構想 |

---

## 驗收

- [ ] 記憶鏈／節點為明確 tab；日週月年可切；鏈可橫拖；點格出 detail
- [ ] graph GET：無互指 → 無邊；單向或雙向引用計入 `refs`；level 1–10
- [ ] 節點大小隨 `display_score`；filter 時 dim 非命中；點節點出 understanding
- [ ] `#/memory/chain/day/{id}` 與 `#/memory/nodes/{id}` 仍可用
- [ ] 契約／changelog／AGENTS＝0.37.0；**無** migrate；backlog 刪 node-network-graph 條

---

## 與相鄰版本

| | 0.36.0 | 本草稿 |
|--|--------|--------|
| 焦點 | 殼＋事件＋DM | 若拍板：記憶鏈＋圖 |
| 記憶內頁 | 列表 | 未承諾 |
