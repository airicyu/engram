# 0.37.0 — 記憶：節點 network graph

← [changelog](../../../changelog.md) · 上游：[0.36.0](../0.36.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**
> **本版只改節點網絡圖。****不**改記憶鏈寫入、**不**改記憶鏈 UI（維持 0.36 左欄列表＋右欄正文）。橫向鏈見 [backlog memory-chain-strip](../backlog/memory-chain-strip.md)，**不**進本版。

## 產品句

> 人在記憶的「節點」模式裡看到一張可縮放、可拖的網絡圖：點大＝較活躍，線深＝互指較密；點開才讀 standing understanding。記憶鏈看起來與 0.36 相同。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/graph.md](./docs/graph.md) | `GET /memories/nodes/graph` 欄位、邊公式、空態、filter |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何不做鏈、為何不算 chain 正文當邊 |
| 4 | [HANDOFF.md](./HANDOFF.md) | 實作 agent 開工 |

相關 backlog：[記憶鏈橫向 UI](../backlog/memory-chain-strip.md)（**本版不做**）。

---

## 問題

0.36 記憶「節點」仍是雙欄列表，看不出誰活躍、誰與誰互指。0.19 `display_score` 已可驅動大小，但沒有邊的 API。記憶鏈列表本版刻意不動。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 範圍 | **只**改 Memory **節點**模式的資料＋畫面。記憶鏈模式（日／週／月／年 pills、左列表、右正文、hash `#/memory/chain/{level}/{id}`）**行為與版面與 0.36 等價**。 |
| 2 | 切換殼 | 頂層「記憶鏈／節點」mode 控制 **維持現有** `mode-btn` pills（**不要**為本版改成底線 tab、**不要**改鏈層級 control）。 |
| 3 | 節點畫面 | 節點模式：**以 force-directed 圖取代左欄 node 列表**。篩選列保留。右側（或圖旁）detail **沿用**現有 `GET /memories/nodes/{id}`（`understanding`＋score 文案）。**不要**改成獨立全屏 3D。 |
| 4 | Hash | 點圖上 node → `#/memory/nodes/{id}`（0.31 字串不變）。深鏈進節點頁仍開圖＋該 id 的 detail。 |
| 5 | 圖資料 | 新增唯讀 **`GET /memories/nodes/graph`**（path 固定）。無 query。Body 見 [graph.md](./docs/graph.md)。**不**寫 `graph/links.yaml`。邊只來自各 L2 `{id}.md` 內 P1 wikilink `[[nodes/{other}/{other}\|…]]`。**不含** chain／STM／activities 正文。 |
| 6 | 大小 | 圖上節點半徑（或等價面積尺度）用 `display_score`（1–100）。`null`＝最小檔（與「無分」同一檔，不要當 0 半徑消失）。 |
| 7 | 邊 | `refs`＝兩 id 之間雙向引用次數總和；`refs>=1` 才有邊。`level = clamp(max(1, ceil(log2(refs))), 1, 10)`（`log2` 以 2 為底）。線顏色深淺對應 level（1 最淡、10 最深）。 |
| 8 | Filter | 節點模式篩選列：**命中 highlight，其餘 dim**（仍畫、仍可點開 detail）。**不要**再像 0.36 列表那樣把非命中從畫面拿掉。清空 query：全部 normal。命中規則與 0.36 客戶端一致：對 **node id 與 preview** 做不區分大小寫包含（見現 `MemoryScene` `filteredNodes`）。圖載入後 filter 只改樣式，不必重打 graph GET。 |
| 9 | 函式庫 | 前端自選 2D SVG／canvas（d3-force、react-force-graph 等）。須能 **縮放畫布**、**拖節點**（調佈局）。**不要** 3D。 |
| 10 | Migrate | **無**新 hop。boot gate 仍 **≥ 0.36**（0.36 已抬）。`store_version` 字串出貨時可 stamp 產品版 `0.37.0`（結構同形，見 AGENTS）。 |
| 11 | 既有 GET | `GET /memories/nodes` 與 `GET /memories/nodes/{id}` **契約不變**。圖 UI 用 graph GET 畫點與邊；detail 仍打 `{id}`。 |

---

## 實作軌道（順序強制：1 → 2 → 3）

### Track 1 — graph API

- 做：`GET /memories/nodes/graph`；phases 測：無互指→`edges: []`；單向／雙向計入 `refs`；`level` 1–10；非法／自指／不存在 id 不進邊；空庫 200＋`present: false`。
- 不做：UI、寫 store、改 chain API。
- 驗收：契約與 [graph.md](./docs/graph.md) 一致；`GET /memories/nodes` 迴歸綠。

### Track 2 — 節點圖 UI

- 做：節點模式換圖；filter dim；點選 detail＋hash；縮放／拖點。
- 不做：改記憶鏈 JSX／樣式／文案（除「共用父層」若必須碰檔，鏈分支須視覺等價）。
- 驗收：`#/memory` 開鏈仍是列表；`#/memory/nodes` 是圖。

### Track 3 — 出貨文件

- 做：`version.md`／`changelog.md`／`docs/api-docs/api.md`／workbench skill 列 graph GET；INDEX → shipped；**刪** `docs/roadmap/backlog/node-network-graph.md` 並改 backlog INDEX。
- 不做：刪 memory-chain-strip。

---

## 非目標

- 記憶鏈橫向 strip、改 chain 層級 control／列表／detail
- 歷史 chain wikilink backfill、vector 搜尋、Seek／Ask 依 `display_score` 排序
- 即時編輯邊、寫回 store、`graph/links.yaml`
- 3D graph、clustering／top-N 裁邊（節點量本原型可全畫）
- 事件／搜索／釐清、抬 boot gate、新 migrate hop

---

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `web/src/scenes/MemoryScene.tsx` | 鏈／節點雙模式；本版只換節點左欄 |
| `web/src/lib/api.ts` | 加 graph client |
| `web/src/lib/hashRoute.ts` | `#/memory/nodes/{id}` 勿改字串 |
| `server` nodes browse 路由 | 並列加 graph |
| `server` wikilink／mentions 解析（0.31 P1） | 邊掃描須同一形 |
| `docs/api-docs/api.md` | 補 GET |
| `docs/roadmap/0.31.0/docs/chain-node-wikilinks.md` | P1 形（邊來源） |

---

## 驗收

- [x] 記憶鏈：日週月年＋列表＋detail＋`#/memory/chain/{level}/{id}` 與 0.36 等價
- [x] `GET /memories/nodes/graph`：無互指無邊；單向或雙向計 `refs`；level 1–10；空＝200 `present: false`
- [x] 節點模式為 2D 圖；大小隨 `display_score`；filter 時 dim 非命中且仍可點
- [x] 點節點出 understanding；hash `#/memory/nodes/{id}` 仍可用
- [x] 契約／changelog／AGENTS＝0.37.0；**無** migrate hop；backlog 刪 node-network-graph 條；memory-chain-strip **仍在** backlog

---

## 開工前仍須拍板

（空。）函式庫與「右側欄 vs 窄抽屜」由實作在「圖＋現有 detail」約束內自選。

---

## 與相鄰版本

| | 0.36.0 | **0.37.0** |
|--|--------|------------|
| 焦點 | 殼＋事件＋DM | **節點 network graph** |
| 記憶鏈 | 列表（本版不改） | **仍列表** |
| 記憶節點 | 列表 | **圖＋既有 detail** |
| Store migrate | 0.28→0.36；boot ≥0.36 | **無** hop；boot 仍 ≥0.36 |
