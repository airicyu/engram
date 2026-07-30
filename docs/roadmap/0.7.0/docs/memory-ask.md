# Memory — Search、L1、Ask

← [INDEX](../INDEX.md)

## 為何拆成三個端點

| 端點 | 誰用 | 做什麼 | 延遲 |
|------|------|--------|------|
| `GET /memory/l1` | Capture | 只看短期 pool 摘要 | ms |
| `GET /memory/search?q=` | Memory（搜尋） | keyword 命中 L1／chain／nodes | ms |
| `POST /memory/ask` | Memory（提問） | AI 讀 store、自然語言回答 | 十秒～數分鐘 |

Capture 不需要全量 nodes；Memory 搜尋與 AI 提問是**不同讀法**，不共用匹配邏輯。

---

## `GET /memory/l1`

Capture 場景專用。取代現行 `GET /recall`（無 `q`）在此場景的用法。

**Response `200`**

```json
{
  "summary": "…",
  "node_notes": { "acme": "…" },
  "present": true
}
```

`present: false` 當 pool 空。不帶 chain、nodes。

---

## `GET /memory/search?q=`

**`q` 必填**（`400 missing_q`）。**`scope` 可選**（逗號分隔 `l1,nodes,chain`，預設全搜；`400 invalid_scope`）。

只回傳 **keyword 命中** 的區塊；未請求的 scope **省略** response key。

| 層 | scope 值 | 匹配規則 |
|----|----------|----------|
| **l1** | `l1` | `summary` 或個別 `node_notes` 含 keyword |
| **nodes** | `nodes` | node id substring、`what.md` 內文、L1 `node_notes` 內文 |
| **chain** | `chain` | 掃描所有 `memory-chain/days/`；summary 優先，無則 ledger fallback |

Response 含 **`scope`** 陣列（echo）。無命中時該 scope 仍出現（`nodes: []`、`l1: null`、`chain: []`）。

| | Search | Ask |
|--|--------|-----|
| 匹配 | **keyword**（substring）+ 可選 scope | agent 自行 grep／讀檔 |
| 輸出 | 結構化 **hits** | 自然語言 **answer** + sources |
| HTTP | 單請求 `200` | `202` + poll |

不含 `dream_status`（見 `/status`）。

**Response `200`** — 見 `docs/api-docs/api.md`。

## Ask — Job 生命週期

```
POST /memory/ask { q }
  → 202 { job_id }
  → background: prepare → agent_spawn → parse_answer
  → GET /memory/ask/{job_id} 直到 status completed | failed
```

### 儲存

```
memory/ask/jobs/{job_id}/
  job.yaml          # status, q, started_at, completed_at, phase, answer?, sources?, error?
  events.jsonl      # 同 0.6.0 事件格式
```

**不**寫 `context.json`（無 server 預組 context）。除錯靠 events + agent log。

### `job.yaml` 草案

```yaml
job_id: ask-20260723-210000-k7x2m9
status: running  # running | completed | failed
q: "上週和 Acme 開會結論是什麼？"
started_at: "2026-07-23T21:00:00+08:00"
phase: prepare   # prepare | agent | parse
completed_at: null
agent_pid: null  # set at agent_spawn; used for cancel / orphan recovery
answer: null
sources: []
error: null
```

### Phase

| phase | 時機 |
|-------|------|
| `prepare` | 寫 job、記錄 store 地圖 meta、啟動 runner 前 |
| `agent` | subprocess 運行中 |
| `parse` | 解析 stdout JSON |

---

## Agent 契約

### 與 dream extract 的差異

| | Dream extract | Memory Ask |
|--|---------------|------------|
| 輸入 | 凍結 `extract-context.json` | **ENGRAM_HOME** 目錄（`--add-dir`） |
| 寫入 | patches（經 approve） | **唯讀**；stdout JSON only |
| Prompt | 讀單一 context 檔 | store 地圖 + `q`；agent 自行 Read／grep |

### Store 地圖（prompt 內，非預載內容）

| 區塊 | 路徑 | 備註 |
|------|------|------|
| L1 | `short-term-memory/` | pool、summary |
| L2 | `nodes/{id}/understand/what.md` | Current 在 `## Current` 下 |
| chain | `memory-chain/days/{id}.summary.md`（優先）、`*.md` ledger | 日級 |
| meta | job 內 `dream_status`、timezone | 非檔案 |

**不讀** `future-sight/`（本版）。**不**預設掃整份 `log/events.jsonl`（L0 太大）；prompt 註明優先 L1／L2／chain。

### Prompt 輸出（必須 JSON）

```json
{
  "answer": "markdown 或 plain text",
  "sources": [
    { "kind": "L2", "node": "acme", "reason": "what.md Current 提到定價" },
    { "kind": "chain", "day_id": "2026-07-21", "reason": "日摘要" },
    { "kind": "L1", "reason": "pool summary" }
  ],
  "confidence": "high"
}
```

### Runner

- 新介面 **`MemoryAskRunner`**（不擴展 dream `AgentRunner.extract`）
- `CursorCliRunner` 同模式：`--add-dir $ENGRAM_HOME`、`--yolo`、parse stdout
- Mock：`ENGRAM_AGENT=mock-ask-ok` 固定 JSON

### 失敗與取消

| 結束方式 | `status` | 說明 |
|----------|----------|------|
| 成功 | `completed` | 正常 parse 答案 |
| 錯誤 | `failed` | exit ≠ 0、parse 失敗 |
| 手動 | `cancelled` | `POST …/cancel` 或 UI 取消鈕 |

**不**寫入 L0／L1／L2。`cancelled` 後可立刻再 ask（釋放 `ask_busy`）。

---

## API

### `POST /memory/ask`

**Request**

```json
{ "q": "required — 自然語言問題" }
```

**Response `202`**

```json
{
  "job_id": "ask-20260723-210000-k7x2m9",
  "status": "started",
  "message": "Poll GET /memory/ask/{job_id} for progress and answer."
}
```

| 狀態 | 說明 |
|------|------|
| `400` | 缺 `q` 或空白 |
| `409 ask_busy` | 已有 running ask |

### `GET /memory/ask/{job_id}`

**Response `200`**（running／completed／failed）

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
  "log_tail": [],
  "error": null
}
```

無此 job → **`200`** + `{ "present": false }`（非 404）。

### `POST /memory/ask/{job_id}/cancel`

手動停止 running ask（使用者或 agent 主動呼叫）。**本版不做自動 timeout。**

| 情況 | 回應 |
|------|------|
| `running` | kill `agent_pid`（先驗證 cmdline／啟動時間）→ `200` `{ status: "cancelled" }` |
| 已完成／已取消 | `200` 現狀（冪等） |
| 無此 job | `200` `{ present: false }` |

實作：spawn 時 register in-memory `proc`；`agent_spawn` event + `job.yaml` 寫 `agent_pid`。Server 正常關機時順便 kill tracked children（可選）。

---

## UI（Workbench Memory）

### 頂欄場景

**Recall** → **Memory**（`scene.memory`／記憶）

### Memory 場景內

Segmented control：**搜尋** | **提問**

| 模式 | 行為 |
|------|------|
| 搜尋 | `GET /memory/search?q=&scope=`；checkbox 選 L1／chain／nodes；只顯示命中區塊 |
| 提問 | 輸入 q → `POST /memory/ask` → 進度 + **取消** → answer markdown + sources |

`409 ask_busy`：提示上一題仍在處理，可取消後再問。

### Capture

L1 區塊改 **`GET /memory/l1`**（不再打 search）。

---

## Server log

`logMemory`／`memory | …` 前綴；agent spawn／finish 預設 **info**（對齊 0.6.0 `logDream`）。

## 建議 events（MVP）

| phase | event |
|-------|-------|
| prepare | `ask_start`, `store_map_ready` |
| agent | `agent_spawn`, `agent_finished` |
| parse | `ask_parsed`, `ask_failed` |
| * | `ask_complete`, `ask_cancelled` |

---

## 後續（非 0.7.0）

- Embedding／hybrid search
- 多輪 session（`session_id`）
- 答案一鍵 capture
- Memory tab 顯示 future-sight
- [Seek × 未來視（0.18）](../../0.18.0/INDEX.md)
