# 0.3.3 WHY

做什麼以 [INDEX](../INDEX.md) 為準。本檔只留動機與邊界。

## 為何現在對齊 Engram 形狀、卻不做 import

使用者要從完整 Engram **搬庫**到 Lite，但 Lite 先前週 id、node id 規則、缺 future-sight 會讓「複製檔案」或「共用 Obsidian 習慣」分叉。本版只改**讀寫契約與薄 API／UI**，讓下一版 **0.4.0** 的離線 import 有明確目標形狀。

## 為何 import 不在 0.3.3

Import 是破壞性高、要隔離測試與 `--from`／`--to` 紀律的操作；與「契約對齊」分開出貨，避免一個 PR 混寫遷移腳本與 HTTP 行為。

## 否決

| 方案 | 為何不選 |
|------|----------|
| 共用 `engram-data` 目錄 | 0.2.0 已定：雙產品踩壞 chain／無 `store_version` |
| GET future-sight 做 full rebucket | 對齊 Engram GET＝expire-only；重分桶留 distill／日後 |
| 只支援 ASCII node | Engram 已允許 Unicode 目錄名；import 需保留 |
