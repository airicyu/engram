# Dream 可觀測性 — 設計細節

← [INDEX](../INDEX.md)

## 目標

1. **使用者**（Workbench）：入夢中看見 phase 與人可讀進度，而非靜態「working」。
2. **開發者**（server console）：預設看見 agent 生命週期與錯誤，不必開 debug env。
3. **事後**：run 結束後仍可 `GET /dream/events` 回看該次 extract／materialize 發生了什麼。

## 事件模型

### 檔案

```
dream/runs/{dream_run_id}/
  events.jsonl    # append-only
```

### 單行 schema

```json
{
  "ts": "2026-07-23T21:00:01.234+08:00",
  "level": "info",
  "phase": "extract",
  "event": "agent_spawn",
  "message": "Spawning cursor agent",
  "detail": {
    "runner": "cursor",
    "work_dir": "/tmp/engram-extract-…"
  }
}
```

| 欄位 | 說明 |
|------|------|
| `level` | `info` \| `warn` \| `error` |
| `phase` | `extract` \| `materialize` \| `pending_review`（與 `dream-job` 對齊） |
| `event` | 穩定識別子，供 UI i18n key 或 fallback 顯示 |
| `message` | 可選人讀摘要 |
| `detail` | 可選結構化欄位（不含完整 stdout） |

### 建議事件清單（MVP）

| phase | event | 時機 |
|-------|-------|------|
| extract | `run_start` | scope 凍結後 |
| extract | `extract_context` | context 組好（events／nodes 計數） |
| extract | `agent_spawn` | subprocess 啟動前 |
| extract | `agent_finished` | exit code + duration_ms + stdout/stderr bytes |
| extract | `extract_parsed` | patch 數 + type 摘要 |
| extract | `extract_failed` | agent 或 parse 失敗 |
| materialize | `materialize_start` | patch 數 |
| materialize | `materialize_patch` | 每筆（detail: patch_id, type） |
| materialize | `materialize_done` | draft + report 就緒 |
| materialize | `materialize_failed` | 任一 materialize 錯誤 |
| * | `run_complete` | pending_review |
| * | `run_failed` | job failed |

`dream-job.yaml` 的 `phase` 仍由既有 `writeDreamJob` 更新；events 與其**並行**寫入，不取代。

## API

### `GET /dream/events`

**Query**

| 參 | 說明 |
|----|------|
| `run_id` | 必填；通常為當前 `dream_job.dream_run_id` |
| `after` | 選填，預設 `0`；已收到的 event 條數（用於增量 poll） |

**Response `200`**

```json
{
  "run_id": "dream-2026-07-23T21:00:00+08:00-…",
  "status": "running",
  "phase": "extract",
  "events": [ { "ts": "…", "level": "info", "phase": "extract", "event": "agent_spawn", "message": "…" } ],
  "total": 42,
  "has_more": false
}
```

| `status` | `running`（lock + 同 run_id）\| `completed` \| `failed` \| `unknown`（無檔／過舊） |

**錯誤：** 缺 `run_id` → `400`；路徑不存在 → `200` + `events: []`（與「無資料不 404」一致）。

### `/status` 擴充

當 `dream_job.status === "running"`：

```json
"dream_job": {
  "status": "running",
  "dream_run_id": "…",
  "phase": "extract",
  "started_at": "…",
  "log_tail": [ /* 最近 ≤20 條 event，與 events.jsonl 同形 */ ]
}
```

UI 預設只 poll `/status`；需要完整歷史再打 `/dream/events`。

## Server console log

| 現況 | 改後 |
|------|------|
| `logAgentSpawn` → `logDreamDebug` | → `logDream`（info） |
| `logAgentResult` → `logDreamDebug` | → `logDream`（info）；`stdout_preview` 仍截斷 |
| `logExtractParseFailed` | → `logDream` + `level: error` event |
| `ENGRAM_DREAM_DEBUG=1` | 額外 dump 完整 preview（維持） |

原則：**console 與 jsonl 雙寫**同一里程碑；jsonl 供 UI，console 供 tail -f。

## UI（Workbench Consolidate）

```
┌─ 入夢中 ─────────────────────────────┐
│ Phase: extract · 已 1m 23s            │
│ ┌──────────────────────────────────┐ │
│ │ 21:00:01  組裝 context（3 events）│ │
│ │ 21:00:02  啟動 agent（cursor）    │ │
│ │ 21:01:10  agent 結束 exit=0       │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- `lock` 或 `dream_job.status === "running"` 時顯示；完成後可摺疊保留最後一次 log。
- i18n：`event` 對應 `consolidate.log.{event}`；無翻譯則顯示 `message`。
- Poll：lock 時 3–5s（可與 status poll 合併讀 `log_tail`）。

## 實作注意

- **寫入順序**：先 append event 再改 phase，避免 UI 看到新 phase 卻無事件。
- **並發**：單 run 單寫入路徑（dream lock 已保證）。
- **敏感**：`detail` 不寫 `ENGRAM_HOME` 全文或 L1 raw；計數與 id 即可。
- **測試**：`mock-ok` agent 應產出可預期 events 序列；`test:phases` assert `total >= N`。

## 已定案

| 題 | 決定 |
|----|------|
| Supersede 舊 run log | **保留**（不刪 `dream/runs/{old_id}/`）；UI 只跟當前 `dream_run_id` |
| Approve 後清 log | **不清**；事後可查 |

## 實作時再定

- Poll 間隔（lock 時 3s vs 5s）
- 其他 UI／埋點細節
