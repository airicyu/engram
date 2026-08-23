# 0.43 HOW — cleanup 檔案與 Ask recent wire

← [INDEX](../INDEX.md)（衝突時 **INDEX 勝**）

本檔鎖實作細節。產品範圍以 INDEX 已定案 A／B 為準。

---

## Dream sweep（Track A）

沿用 `sweepDreamArtifacts()`。在現有「刪 report＋events dir」成功路徑（含 dry-run 只記不刪）**同一 `run.id`** 再刪：

- `storePath("dreams", "runs", `${id}.yaml`)`
- `storePath("dreams", "runs", `${id}.input.json`)`（缺檔不當錯）

跳過：`getPendingRun()` 的 id；`listDreamRuns()` 裡 `l1_clear_pending === true`。

`DreamCleanupResult` 增：

```ts
run_yamls_removed: string[];
input_jsons_removed: string[];
```

測試至少：committed 達齡四檔皆無；pending 四檔仍在；`l1_clear_pending` yaml 仍在；`-1` 不刪 committed。

0.21 文件「永不自動刪 yaml」以 **本版 INDEX／本檔／`docs/configurations.md` 為現況**。不必改寫整份 0.21 歷史稿；configurations 註「0.43：yaml／input 與 report 同 TTL」。

---

## Ask history 檔（Track B）

路徑：`{ENGRAM_STORE_DIR}/dreams/ask-history/{job_id}.json`（UTF-8 JSON）。

建議欄位（可多不可少）：`job_id`、`q`、`status`（`completed`｜`failed`｜`cancelled`）、`started_at`、`completed_at`、`answer`（string｜null）、`error`（失敗時）、`sources`（可存、**list／UI 不回**）。

寫入時機：job 進入終態且 `ask_history_retention_hours > 0`。`0` 則不寫、sweep 可清光既有 history 檔。

`answer_preview`：`answer` trim 後空白→`null`；否則取前 **80** 個 UTF-16 code unit，超出加 `…`。

`GET /memories/ask/recent` 合併：history 檔＋ **running** temp job（若有）。同一 `job_id` 只出現一次（running 優先）。

Config 合法值：hours 非負整數；max_entries ≥ 1。非法 workspace → 既有 failWorkspace 風格。

根 `GET /` endpoints 加 `"GET /memories/ask/recent"`。

---

## UI（Track C）

僅 `mode === "ask"`。列表在表單與答案區之間或表單一側皆可，但 **不得** 擋住答案 flex 填滿。每列：時間、`q` 截斷、status 文案（i18n）。選中列 `GET` 單筆後設 `askQ` 與展示 answer（completed）；failed 展示 error 句，不當成成功答案。

繁中鍵建議：`seek.recent_asks`、`seek.recent_empty`、status 對應 `memory.ask_*` 能複用則複用。
