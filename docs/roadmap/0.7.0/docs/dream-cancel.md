# 入夢 Cancel

← [INDEX](../INDEX.md)

> **0.7.0** — 與 Ask cancel 同版；共用 agent process registry + `agent_pid` 模式。

## 要解什麼

入夢 **running** 時可手動 cancel；效果等同 **丟掉這次 run**（與 discard 語意相近，但時機不同）。Cancel 後 **`dream/run` 從頭重來**。**不支援 resume**。

## Cancel = 停 + revert（一次完成）

```
1. kill agent（extract；`agent_pid`）
2. abort materialize（AbortSignal，若在進行）
3. release dream lock
4. removeDraft(dream_run_id)
5. 標記 run abandoned（patches.jsonl 行保留 audit）
6. dream-job → cancelled；extract-state 可再入夢
7. event: dream_cancelled
```

## API

### `POST /dream/cancel`

可選 body `{ "dream_run_id": "…" }`；省略時 cancel **當前 running** job。

**Response `200`**

```json
{ "dream_run_id": "dream-…", "status": "cancelled" }
```

| 狀態 | 說明 |
|------|------|
| `409` | 無 running job |
| `409 dream_run_mismatch` | 指定的 `dream_run_id` 不是當前 running |

**不做**自動 timeout；**不改** stale lock 行為。

### 與 Discard

| | **Cancel** | **Discard**（已有） |
|--|------------|---------------------|
| 時機 | `dream_job.status === "running"` | `pending_review` |
| 語意 | 別跑了，當沒發生 | 審完了，不要這份結果 |
| 清理 | 同上 revert 清單 | `discardPending` |

實作可共用 `abandonDreamRun(run_id)` helper；API 分開。

## `dream-job.yaml` 擴充

```yaml
agent_pid: null   # agent_spawn 時寫入
```

## UI（Consolidate）

入夢中（lock + progress panel）顯示 **取消** 鈕 → `POST /dream/cancel`。

## 與 Ask cancel 共用

| 共用 | 說明 |
|------|------|
| `store/agent-process.ts` | in-memory `proc` + `agent_pid` register／kill |
| PID 驗證 | kill 前查 cmdline／啟動時間 |
| 手動 only | 無 auto timeout |

## Events

| event | 時機 |
|-------|------|
| `dream_cancelled` | cancel 成功 |
| `agent_spawn` | detail 加 `pid` |

## 參考

- Ask cancel：[memory-ask.md](./memory-ask.md)
- Stale lock：`server/src/store/lock.ts`（本版不改动）
