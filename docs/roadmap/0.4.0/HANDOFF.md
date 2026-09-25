# 0.4.0 HANDOFF

狀態：`planned`。先讀 [INDEX](./INDEX.md)、[docs/how.md](./docs/how.md)、[docs/reasoning.md](./docs/reasoning.md)。

## 做什麼

離線 `scripts/import-from-engram.ts`：`--from` Engram store（唯讀）→ `--to` 新 Lite store。轉 chain summary、複製 nodes／attachments／future-sight、STM pool→pending、workspace 映射。虛構 fixture 測試。

## 不要做

- HTTP migrate、改 Engram 來源、搬 clarify／dream
- 用真人 engram-data 當 fixture
- server 拆目錄（除非 import 需要共用函式——優先從 `chain-time.ts` import）

## 驗收

INDEX 勾選項 + `bun test` 全綠 + dry-run 輸出可讀。

## 拍板待確認

見 INDEX「開工前仍須拍板」：pool id 重寫、--force 合併策略。未決前實作採 INDEX **建議** 欄。
