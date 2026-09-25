# Backlog — 節點活躍分（display score）

← [INDEX](./INDEX.md)

**狀態：** 未排程（資料模型未定）

## 產品句

記憶／節點詳情可顯示 Engram 式 **「活躍分 n / 100」**（`memory.score_display`），與 consolidate 涉入一致。

## 依賴

- Engram：`memories.nodes` 的 score／涉入欄位與 consolidate 寫入邏輯。
- Lite：目前 **無** 對應欄位；[0.5.0 UI 還原](../0.5.0/INDEX.md) **刻意不做**假 UI。

## 排程時須定案

1. Vault 是否持久化 score（frontmatter vs 旁檔）或僅 runtime 衍生。
2. Lite distill 是否維護涉入；若否，import 時是否只讀 Engram 快照。
3. `GET /nodes/:id` 回傳形狀與 UI `browse-meta` 對齊。

## 驗收（草案）

- 虛構 node fixture 含 score；UI 與 Engram 同文案格式。
- 無 score 時顯示 `—`（Engram `memory.score_none`）。

← [0.5.0](../0.5.0/INDEX.md)
