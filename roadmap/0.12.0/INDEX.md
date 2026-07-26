# 0.12.0 — Dream Retry with Reason

← [changelog](../../changelog.md) · 上游：[0.11.0](../0.11.0/INDEX.md) · current: [version](../../version.md) · 構想來源：[backlog/dream-retry-with-reason.md](../backlog/dream-retry-with-reason.md)

> **狀態：** **shipped（0.12.0）**  
> Pending review 三選一：**Approve／Discard／Retry with reason**；移除無理由「入夢（取代）」。

## 產品句

> 人審 dream 偏了時，可帶修正意見對**同一凍結 scope**再抽一次；不必手改 store，也不再無理由 supersede。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | Pending 三動作 | **Approve**／**Discard**／**Retry with reason**；移除 UI「入夢（取代）」 |
| 2 | 無理由重跑 | `pending_review` 時 **`POST /dream/run` → 409** `pending_review`（禁止 supersede） |
| 3 | Retry 語意 | 先快照上一輪 summary + `scope` → **discard** → **新 `run_id`** 對同一 scope 再 extract |
| 4 | Agent context | reason + 上一輪 patches／draft 摘要（非整份 draft 樹） |
| 5 | 連續 retry | 每次只用剛 discard 那輪的新 summary；scope 始終是最初凍結的 event ids；reason 不累積 |
| 6 | 舊 run 狀態 | Retry 路徑標 **`discarded`**（與 Reject 相同） |
| 7 | API | **`POST /dream/retry`**，`{ reason }` 必填；可選 `{ dream_run_id }` |
| 8 | 稽核 | reason + `retried_from` 寫入新 run yaml／report；不寫 L0 |
| 9 | Rollup | 不另餵 reason |
| 10 | 非目標 | 手改 patch、多輪 chat UI、改 Cancel |

## 驗收

- [x] Pending 時 UI 僅 Approve、Discard、Retry with reason
- [x] `POST /dream/run` 在 pending → 409；retry 空 reason → 400
- [x] Retry 後新 pending 的 `scope` 與被 discard 那輪相同；L1 未在 retry 時被清
- [x] Extract context／report 可見 reason + 上一輪摘要
- [x] 連續兩次 retry：第二次帶第一次 retry 產出的摘要；scope 仍為最初那批 ids
- [x] `bun run test:phases` 全過

## 錨點

| 路徑 | 角色 |
|------|------|
| `server/src/dream/run.ts` | `runDream` 禁 supersede；`retryDream` |
| `server/src/api/dream.ts` | `POST /dream/retry` |
| `server/src/agent/types.ts` | `ExtractContext.review_feedback` |
| `server/prompts/extract.md` | 注入 review feedback |
| `web/src/scenes/ConsolidateScene.tsx` | 三動作 UI |
| `api-docs/api.md` | 契約 |
