# Dream review：Retry with reason（backlog）

← [backlog](./INDEX.md)

> **狀態：** 構想筆記；尚未排進版本。  
> 觸點：Consolidate／dream pending review（目前 `approve` / `discard`）。

## 為何想做

人審 dream 結果時，有時不是「全對可 commit」也不是「整批丟掉」，而是「方向偏了，但希望 AI **帶著修正意見再抽一次**」。

今日只有兩條路：

| 動作 | 行為 |
|------|------|
| Approve | commit draft → L2；清 scope S（不變） |
| Discard / Reject | 丟 pending + draft；L1／L2 不變（不變） |

缺中間態：**Revert pending，立刻以使用者理由為補充 context 再跑 dream**。

## 構想：三選一

Pending review 時 UI／API 提供：

1. **Approve** — 與現況相同  
2. **Retry with reason** — 等同 reject（revert pending + draft），但**必填 reason 文字**；接著以該 reason 作為 **supplement context prompt** 重新 `dream/run`（同一批待蒸餾輸入，外加理由）  
3. **Reject** — 與現況 `discard` 相同，純丟棄、不自動重跑

## 預期行為（草案）

```
pending_review
  ├─ approve        → commit（今日）
  ├─ retry + reason → discard/revert → dream/run（prompt += reason）
  └─ reject         → discard（今日）
```

- Reason 為人寫短文（為何不對、該怎麼改），注入 extract agent 的補充上下文，**不是**改 patch 手編。  
- Retry 成功後應再進入 `pending_review`（或 extract 失敗路徑與一般 `dream/run` 一致）。  
- Reject 不帶 reason、不觸發重跑。

## 開放問題（日後討論）

1. API 形狀：新端點（如 `POST /dream/retry` + `{ reason }`）還是擴充既有 discard／run？  
2. Reason 只進當次 extract prompt，還是也寫入 L0／run report 供稽核？  
3. Retry 是否沿用同一 `run_id` 語意，或一律新 run（supersede）？  
4. 連續多次 retry 時，是否累積歷次 reason，或只帶最近一次？  
5. Lock／`dream_locked` 與 supersede 規則是否與今日 `POST /dream/run` 對齊？

## 非目標（預設）

- 不是讓使用者手改 patch／draft 再 approve  
- 不是 Chat 式多輪改稿 UI（僅一次 reason → 重跑）  
- 不取代 Cancel（執行中取消；見 0.7.0）
