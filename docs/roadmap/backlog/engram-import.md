# Backlog — Engram store → Engram Lite import

**狀態：** 未排程。前置：[0.3.3](../0.3.3/INDEX.md) 對齊契約出貨後再實作離線 script。

## 要做

| 來源（Engram） | Lite 目標 | 備註 |
|----------------|-----------|------|
| `memories/chain/**/*.summary.md` | `memories/chain/**/{id}.md` | day／week／month／year；week 檔名已是 `YYYY-Www-MMDD` |
| `memories/nodes/**` | 同形 | Unicode id 保留 |
| `memories/_attachments/**` | 同形 | |
| `memories/future-sight/upcoming.md`＋`longTerm.md` | 同形 | |
| `memories/short-term-memory/pool.jsonl` | `memories/pool/pending.jsonl` | 欄位映射；`id` 可重寫為 `evt_*` |
| `engram.workspace.yaml` | `workspace.yaml` | 丟 `store_version`；保留 tz／語言／future_sight_* |

## 不做（第一版）

- `{store}/dreams/`
- `memories/clarify/**`（使用者手動或第二版）
- `memories/activities/events.jsonl` 當第二真相（以 STM pool 為未沉澱來源；若 pool 空再考慮 activities）
- In-place 改 `engram-data`；**只寫新 Lite store**

## 實作形狀

離線 `bun run scripts/import-from-engram.ts --from … --to …`（+ 虛構 fixture 測試）。可選薄 skill 只負責確認路徑與呼叫 script。
