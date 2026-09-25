# 0.4.0 WHY

做什麼以 [INDEX](../INDEX.md) 為準。

## 失敗模式：假相容

把 Lite 指到 `engram-data` 或 in-place 改 Engram 庫，會讓 Engram boot／dream 雙軌 chain 與 Lite 單檔 distill **互踩**。Import 必須是 **新目錄、一次性轉形、來源唯讀**。

## 失敗模式：把遷移做成 server 功能

Import 是少次數、高風險、需 dry-run 的操作；不屬於日常 HTTP。放在 **script + 測試**，符合「program 只做控制面」——遷移是機械 I/O，不是語意判斷。

## 為何第一版不搬 clarify／dream

- Clarify 在兩邊 lifecycle 不同（Lite 無 dream report）；強搬易有半套狀態。
- Dream 是 Engram 派工暫存，不是 vault 敘事；Lite 無對應目錄。
- 使用者仍可在 Engram 側處理未結 clarify，或在 Lite 重新 capture／distill。

## 為何 STM pool 優先於 activities

0.35+ Engram 未沉澱真相在 `short-term-memory/pool.jsonl`；`activities/events.jsonl` 是 L0 雙寫之一，import 先以 **pool** 對齊 Lite `pending.jsonl`，減少重複與 mention 格式差。

## 否決

| 方案 | 為何不選 |
|------|----------|
| Pi skill 逐檔改寫 | 不可測、不可重跑 |
| 只複製 nodes 不轉 chain summary | 日記仍在 Engram 雙軌，Lite UI 讀不到 |
| Import 順便跑 distill | 語意判斷；應由使用者按鈕或 crontab |
