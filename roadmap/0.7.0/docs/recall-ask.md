# Recall Ask — 非同步 AI 問答

← [INDEX](../INDEX.md)

## 為何不用同步 `GET /recall?q=`

| | Sync packet | Ask job |
|--|-------------|---------|
| 延遲 | 毫秒級 | 十秒～數分鐘 |
| 輸出 | 結構化脈絡（給人／下游 LLM） | **自然語言答案** + 引用 |
| 匹配 | keyword | agent 語意閱讀 + 可選 keyword 預篩 |
| HTTP | 單請求 | **202 + poll**（對齊 `POST /dream/run`） |

## Job 生命週期

```
POST /recall/ask { q }
  → 202 { job_id }
  → background: build_context → agent_spawn → parse_answer
  → GET /recall/ask/{job_id} 直到 status completed | failed
```

### 儲存

```
recall/jobs/{job_id}/
  job.yaml          # status, q, started_at, completed_at, phase, answer?, error?
  events.jsonl      # 同 0.6.0 事件格式
  context.json      # 可選：凍結給 agent 的 context（debug；可關）
```

### `job.yaml` 草案

```yaml
job_id: ask-2026-07-23T21:00:00+08:00-abc1
status: running  # running | completed | failed
q: "上週和 Acme 開會結論是什麼？"
started_at: "2026-07-23T21:00:00+08:00"
phase: context  # context | agent | parse
completed_at: null
answer: null
sources: []
error: null
```

## Context 組裝

起點：現有 `handleRecall(q)` 的資料面，但為 agent 可再加：

| 區塊 | 來源 | 備註 |
|------|------|------|
| L1 | `readSummary` + `node_notes` | 與 sync 相同 |
| chain | `readDayForRecall(today)` | summary 優先 |
| L2 | `what_current` per node | **Ask 版**：keyword 命中 + 可選「全 node ≤N」或「what 前 500 字」 |
| meta | `dream_status`、timezone | 讓 agent 知道 pending_review 等 |

不讀 future-sight（0.4 決策）。不掃整份 L0（太大）；若 L1 已清，靠 L2 + chain + 必要時 **有限** L0 grep（非本版 MVP — 僅 L1/L2/chain）。

## Agent 契約

### Prompt 要點

- 讀 `context.json`（或內嵌路徑）
- 回答使用者問題 `q`
- **必須**輸出 JSON（`--output-format json` 或 fenced block）：

```json
{
  "answer": "markdown 或 plain text",
  "sources": [
    { "kind": "L2", "node": "acme", "reason": "what.md Current 提到定價" },
    { "kind": "chain", "day_id": "2026-07-21", "reason": "日摘要" }
  ],
  "confidence": "high"
}
```

### Runner

- 新介面 `RecallAskRunner` 或擴展 `AgentRunner` 第二方法 `ask(ctx)`
- 實作：`CursorCliRunner` 同模式（tmp work dir、spawn、parse）
- Mock：`mock-ask-ok` 回固定 JSON（測試用）

### 失敗

- exit ≠ 0、parse 失敗、timeout → `status: failed`，`error` + `events` 最後一條 `ask_failed`
- **不**寫入 L0/L1/L2

## API

### `POST /recall/ask`

**Request**

```json
{ "q": "required — 自然語言問題" }
```

**Response `202`**

```json
{
  "job_id": "ask-2026-07-23T21:00:00+08:00-abc1",
  "status": "started",
  "message": "Poll GET /recall/ask/{job_id} for progress and answer."
}
```

**Errors**

| 狀態 | 說明 |
|------|------|
| `400` | 缺 `q` 或空白 |
| `409 ask_busy` | 已有 running ask（若採單 job 策略） |
| `409 dream_locked` | **不**擋（唯讀）— 僅在 commit 期間若未來讀到不一致再加 |

### `GET /recall/ask/{job_id}`

**Response `200`**

```json
{
  "job_id": "…",
  "status": "running",
  "phase": "agent",
  "q": "…",
  "started_at": "…",
  "completed_at": null,
  "answer": null,
  "sources": [],
  "log_tail": [ /* 同 0.6.0 */ ],
  "error": null
}
```

完成時 `answer` + `sources` 有值。無 job → `200` + `{ "present": false }`（或 `status: "unknown"` — 實作時二選一寫進 api-docs）。

### 與 `GET /recall` 對照

| | `GET /recall?q=` | Ask job |
|--|------------------|---------|
| 用途 | 取脈絡包、keyword 預覽 | 取 AI 綜述答案 |
| 延遲 | 低 | 高 |
| dream lock | 不擋 | 不擋 |
| UI 場景 | Recall「脈絡」 | Recall「問答」 |

## UI（Workbench Recall）

- 子模式切換（segmented control）：**脈絡** | **問答**
- 問答：輸入框 + 送出 → disabled + 進度區（複用 0.6.0 log 元件）
- 完成：渲染 `answer`（markdown）；`sources` 可摺疊列表
- 失敗：顯示 `error` + log tail

## Server log

沿用 0.6.0：`logRecall` / `recall | …` 前綴；agent spawn/finish 預設 info。

## 已定案

| 題 | 決定 |
|----|------|
| 並發 | **同時只允許一個 ask job**；新 ask → **409 `ask_busy`** |
| API 路徑 | **`/recall/ask`**（與 recall 域一致） |

## 實作前再討論

- L2 context 廣度（無 keyword 命中時的上限）
- 舊 job 清理策略（保留 K 份等）
- 其他 UI／agent 契約細節

## 後續（非 0.7.0）

- Keyword 預篩 + embedding 混合
- 多輪 session（`session_id`）
- 答案一鍵 capture 回 L1
- [Recall 注入 future-sight](../../backlog/recall-future-sight.md)
