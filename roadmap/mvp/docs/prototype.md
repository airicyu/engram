# Prototype — Implementation Proposal

← [INDEX](../INDEX.md) · [dream](./dream.md) · [activation](./activation.md)

> **目的：** 用最小可跑系統驗證 MVP 句——  
> **≤3 個 node + L0 + L1 + `dream run`（what + day + candidates + L0.5）是否比全量 rewrite 更穩？**  
> 本文只定實作邊界與階段；**寫完並同意後才動手寫 code。**

## 定案（prototype）

| 決策 | 選擇 |
|------|------|
| 本體 | Bun HTTP server |
| 操作面 | REST API（無 UI） |
| Agent | Claude Code headless only |
| 抽象 | `AgentRunner` interface；實作 `ClaudeCodeRunner` |
| 不做 | Cursor CLI / SDK adapter、定時排程、多租戶、embedding |

### 契約細則（已定）

| 題 | 定案 |
|----|------|
| Extract 部分 patch schema 不過 | **整段失敗**（不清 L1、不寫 L0.5）；不採「丟壞留好」 |
| `dream/run` 中途 crash | 若本 run 已有 L0.5、尚未清 L1 → **同 `dream_run_id` 只 resume apply**（不重跑 extract）；L1 已清才允許新 extract／新 id |
| Claude Code 權限 | **禁寫檔**：Bun 餵 context 檔 + `-p`；只信 stdout JSON；不讓 agent 改 `ENGRAM_HOME` |
| Episodic ≥ 0.6 | **P1–P2 不寫 chronology**；延到 Phase 4（optional） |
| `l2_current` 篩選 | Prototype ≤3 node → **一律帶全部現有 node** 的 what Current |
| `dream_run_id` | ISO 時間戳（含時區），如 `dream-2026-07-18T23:10:00+08:00` |

**不變原則（對齊設計）：**

- LLM **只**提案 patches；機械層負責 schema、落盤、apply、冪等、lock、清 L1
- Agent **不**直接寫 L2 / `patches.jsonl`；Bun 校驗後才 append
- Single thread：同時只允許 Ingest **或** Dream

---

## 目錄佈局

```
engram/
├── seed-idea/                 # 設計（本目錄，不變）
├── server/                    # Bun API + mechanical core
│   ├── package.json
│   ├── src/
│   │   ├── index.ts           # HTTP entry
│   │   ├── api/               # routes
│   │   ├── store/             # L0–L2 檔案 I/O
│   │   ├── dream/             # extract orchestration + apply
│   │   ├── activate/          # activation packet
│   │   └── agent/             # AgentRunner + ClaudeCodeRunner
│   ├── prompts/               # extract skill / prompt 模板
│   └── fixtures/              # Phase 1 手寫 patches
└── data/                      # ENGRAM_HOME（gitignore）
    ├── meta.yaml
    ├── log/events.jsonl
    ├── dream/
    ├── short-term-memory/
    ├── memory-chain/days/
    ├── candidates/
    ├── nodes/                 # 人批准後才有內容；prototype 可預置 ≤3 個
    └── archive/
```

環境變數：`ENGRAM_HOME`（預設 `engram/data`）、`CLAUDE_BIN`（可選）。

---

## 職責切分

```
Client
  │  HTTP
  ▼
Bun API  ─── 機械層（確定性）
  │            ingest / apply / lock / schema / activation assemble
  │
  └── AgentRunner.extract(ctx) ──► Claude Code headless
         in:  prepared context（字串／檔）
         out: Patch[]（JSON；Bun 校驗後寫 L0.5）
```

### `AgentRunner`（契約）

```typescript
interface ExtractContext {
  dream_run_id: string;
  timezone: "Asia/Taipei";
  l1: { today_summary: string; node_notes: Record<string, string> };
  events: Array<{ id: string; ts: string; raw: string; node_refs?: string[] }>;
  l2_current: Array<{ node: string; what_current: string }>; // 相關 node 的 Current 段
  existing_nodes: string[]; // 已知 node id（含 aliases 可後期）
}

interface AgentRunner {
  extract(ctx: ExtractContext): Promise<Patch[]>;
}
```

- extract **整段失敗**（非 JSON / 任一 patch schema 不過 / process exit ≠ 0）→ throw；API 回 `dream_incomplete`；**不清 L1、不寫 L0.5**
- 成功 → Bun append `dream/patches.jsonl`（同 `dream_run_id` 已存在則不重複寫）→ 進 apply
- **Resume：** `POST /dream/run` 發現同 id 已有 patches、L1 未清、apply 未完成 → skip extract，只跑剩餘 apply

### Claude Code 呼叫（草案）

- `claude -p`（print / headless）+ 固定 prompt 模板
- Bun 把 `ExtractContext` 寫成臨時檔再餵 prompt；**agent 不寫 `ENGRAM_HOME`**（禁 tool 寫檔／或 cwd 隔離於 temp）
- stdout 期望：單一 JSON array（或 fenced JSON）；解析或 schema 失敗 = extract 整段失敗

---

## API 表面（MVP）

| Method | Path | 行為 |
|--------|------|------|
| `POST` | `/ingest` | append L0 + 寫 L1；Dream 持 lock 時 **409** |
| `POST` | `/dream/run` | 取 lock → extract → apply → clear L1 → 放 lock |
| `GET` | `/activate?q=` | 組 activation packet（可無 `q`） |
| `GET` | `/status` | lock、L1 empty?、pending DLQ count、`dream_status` |

**Prototype 不做：** DLQ adhoc review API、approve candidate API、定時 cron。  
candidates / 建 node：手改 yaml（對齊設計「介面暫不做」）。

### Request / response 草約

**`POST /ingest`**

```json
{ "raw": "...", "source": "api", "node_refs": ["acme"], "idempotency_key": "optional" }
```

→ `{ "event_id": "e000001" }`

**`POST /dream/run`**

→ `{ "dream_run_id": "dream-2026-07-18T23:10:00+08:00", "applied": ["p1"], "dead_letter": ["p2"], "extract_status": "ok" }`  
extract 失敗 → `4xx/5xx` + `{ "extract_status": "failed", "dream_status": "dream_incomplete" }`（L1 保留）

**`GET /activate`**

→ packet：`sources`、`dream_status`、L1 片段、day chain、matched nodes 的 what Current（見 [activation](./activation.md)）

---

## Apply 範圍（prototype = MVP required）

| Patch type | Apply 行為 |
|------------|------------|
| `semantic` `facet: what` | 寫／revise `nodes/{id}/understand/what.md`（Current/History + event_refs + patch_id） |
| `chain` `level: day` | append／merge `memory-chain/days/YYYY-MM-DD.md` |
| `propose_node` | upsert `candidates/nodes.yaml` |
| `episodic` confidence `< 0.6` | upsert `candidates/attribution.yaml`（不寫 chronology） |
| `episodic` ≥ 0.6 | **P1–P2：不 apply 正文**（可略過或只留 L0.5）；`chronology/recent.md` → Phase 4 |

**不做：** 其他 facet、week/month、graph link、`reattribute` apply、自動建 `nodes/{id}/`、rebuild、embedding。

Node 不存在（semantic / episodic 指向未知 id）→ 該 patch → DLQ，繼續。

---

## 階段拆分

風險遞增：**先證明機械層，再接 agent，最後讀路徑。**  
每階段有明確 exit criteria；沒過不進下一階段。

### Phase 0 — 骨架與 Ingest

**做：**

- `engram/server` Bun 專案、`ENGRAM_HOME` 初始化（空目錄樹 + `meta.yaml`）
- `POST /ingest`：L0 `events.jsonl` + L1（`today-summary.md` append；可選 `nodes/{id}/notes.md` 若有 `node_refs`）
- `GET /status`（lock=false、L1 非空偵測）
- Dream 進行中 ingest → 409

**不做：** agent、apply、activate

**Exit：** curl ingest 兩次 → L0 兩行、L1 可見；重啟 server 資料仍在。

---

### Phase 1 — Apply 機械層（無 agent）

**做：**

- Patch schema 校驗（TS types + runtime parse）
- `dream-apply`：`dream.lock`、`applied.yaml` 冪等、per-patch 成功／DLQ、跑完清 L1
- Fixture runner：`fixtures/*.jsonl` → 等同 extract 已寫好的 L0.5，只跑 apply
- 支援 patch：`semantic/what`、`chain/day`、`propose_node`；低置信 episodic → attribution candidate
- 預置 ≤3 個正式 node（手建目錄）供 fixture 寫 what

**不做：** Claude Code、真實 extract

**Exit：**

1. fixture 全成功 → L2 what + day + candidates；L1 空；`applied.yaml` 齊  
2. 故意壞一筆 → 進 `dead-letter.jsonl`；其餘仍 apply；L1 仍清  
3. 同 `patch_id` 再跑 → skip（冪等）

→ **此時已能驗證「patch + apply vs 全量 rewrite」的機械假設。**

---

### Phase 2 — Claude extract + `dream run` 串起來

**做：**

- `AgentRunner` + `ClaudeCodeRunner`
- Bun 組 `ExtractContext`（L1 + 當日 events + 相關 L2 Current）
- `POST /dream/run` = lock → extract → append L0.5 → apply → clear L1
- extract 失敗契約（L1 保留、`dream_incomplete`）
- prompt／skill：只允許輸出允許的 patch types；強調 vs Current 的 append／revise

**不做：** Cursor adapter、多輪 resume、adhoc DLQ review API

**Exit：**

1. ingest 數條真實文字 → `dream/run` → L0.5 有 patches、L2／candidates 有寫入、L1 空  
2. extract 故意弄壞（壞 prompt／mock fail）→ L1 仍在、可重跑  
3. 同 `dream_run_id` 不重複 append L0.5

---

### Phase 3 — Activation 讀路徑

**做：**

- `GET /activate`：L1（若有）+ 當日 day + 關鍵字／`node_refs` 匹配 nodes 的 what Current
- packet 標 `sources`、`dream_status`（含 `dead_letter_pending`）
- MVP：接受常漏上下文；無 embedding

**Exit：** dream 前後各 activate 一次，能看出 L1→L2 切換與 `dream_status` 誠實標示。

---

### Phase 4（optional，同 sprint 可砍）

- primary episodic → `chronology/recent.md`
- ingest `idempotency_key`／content hash
- 同日多次 `dream_run` 的 day 檔 merge 規則寫死並測

**不做（明確延後）：** DLQ settlement／adhoc dream API、week/month、T1–T4、graph、UI。

---

## 建議實作順序（單檔 checklist）

```
[x] Phase 0  Ingest + status + ENGRAM_HOME
[x] Phase 1  Fixture apply + lock/DLQ/idempotency
[x] Phase 2  ClaudeCodeRunner + POST /dream/run
[x] Phase 3  GET /activate
[ ] Phase 4  Optional polish（可砍）
```

預估量級（一人、設計已齊）：P0 小、P1 中（apply 細節）、P2 中（agent 邊界）、P3 小。  
**卡關優先修機械契約，不要用更大 prompt 掩蓋 schema／幂等 bug。**

---

## 與設計文件的對齊／刻意縮水

| 設計 | Prototype |
|------|-----------|
| 日間／夜間不並行 | API lock + 409 |
| extract LLM / apply 規則 | ✓ |
| DLQ review 流程 | 只產生 pending；恢復用手改／之後再做 |
| candidates → 人批准建 node | 手改；API 不建 node |
| Activation P0 | 關鍵字；無 1-hop graph（MVP 無 links） |
| 定時 23:00 dream | 手動 `POST /dream/run` 即可 |

開放設計項（adhoc extract 契約等）**不擋**本 prototype；見 [design-review](./design-review.md)。

---

## 同意後才做

本文是 **implementation proposal**，不是已開工的規格凍結。同意後：

1. 從 Phase 0 開 `engram/server`
2. 每階段結束用 Exit criteria 自測，再進下一階段
3. 契約變更回寫本文與 [dream](./dream.md)（若影響已定案行為）
