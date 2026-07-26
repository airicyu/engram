# Dream review：Retry with reason

← [backlog](./INDEX.md) · **已排進 [0.12.0](../0.12.0/INDEX.md)**

> **狀態：** 已排進 **0.12.0**（實作見該版 INDEX）。  
> 觸點：Consolidate／dream pending review。

## 定案摘要（0.12.0）

Pending 三選一：**Approve**／**Discard**／**Retry with reason**。

- **Retry**＝快照上一輪 draft／patches 摘要 + 凍結 `scope` → discard 當前 pending → 新 `run_id` 對同一 scope 重跑 extract，prompt 注入 reason + 上一輪摘要。
- 連續 retry：每次帶剛 discard 那輪的新 summary；scope 不變；reason 只帶當次。
- 移除無理由「入夢（取代）」：`pending_review` 時 `POST /dream/run` → 409。
- API：`POST /dream/retry` + `{ reason }`（必填）。

## 非目標

- 手改 patch／draft 再 approve  
- Chat 式多輪改稿 UI  
- 不取代 Cancel（0.7.0）
