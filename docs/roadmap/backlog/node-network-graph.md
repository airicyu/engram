# Backlog — Node network 互動圖（Obsidian 式）

← [backlog INDEX](./INDEX.md) · 資料模型草稿：[0.1 nodes-graph](../../0.1.0/docs/nodes-graph.md) · 相關：[Seek／network 依活躍分](./INDEX.md)（檢索偏置，非本項）

## 題目

在 Memory 場景（或獨立視圖）提供 **互動式 network graph**：節點＝ L2 node，邊＝連結／共現／未來 `graph/links.yaml`；支援縮放、拖曳、點選進入 node 詳情；視覺上可比 Obsidian graph view。

## 現況（0.20）

- MVP **未寫** `graph/links.yaml`；0.8 web IA 明訂「不做 graph」
- 0.19 **node 活躍分** 已可驅動 **節點大小**（本項可消費，但與 Seek 排序 backlog 不同）
- Memory UI：列表／chain／node 文字閱讀，無 force-directed 圖

## 粗範圍（將來定案）

- **資料**：`GET /memories/nodes` + 連結來源（先 heuristic 共現 vs 正式 link 檔）
- **前端**：canvas／SVG（d3、sigma、react-force-graph 等實作時再選）
- **互動**：點 node → 現有 node detail；可選 filter by score／時間
- **效能**：大量 node 時 clustering 或 top-N

## 非目標（構想階段）

- 即時編輯 graph 寫回 store（另版＋API）
- 3D graph
