# Ingest & Dream（寫入與整合）

← [INDEX](../INDEX.md) · [short-term](./short-term.md)

## Ingest

不管 input 從哪來，統一：

```
input → (1) append L0 event
      → (2) write L1 short-term
      → (3) 可選粗標 node_refs
```

### Event schema（草案）

```json
{
  "id": "e000042",
  "ts": "2026-07-14T10:00:00+08:00",
  "source": "chat",
  "raw": "...",
  "node_refs": ["acme"],
  "ingest_meta": { "salience": 0.7 }
}
```

Ingest 要快、確定、可重跑；**不做**完整 digest。  
**MVP：** 日間只 Ingest；夜間只 Dream；兩者不並行（見執行模型）。

---

## L1.5 — Dream patch log（已定案）

```
dream/patches.jsonl           — Dream 決策原稿（JSON Lines，append-only）
dream/applied.yaml            — 已成功 apply 的 patch_id（冪等）
dream/dead-letter.jsonl       — pending DLQ（apply 失敗待審）
dream/dead-letter-archive/    — 已離開 pending 的 DLQ（可追溯；不刪歷史）
dream/reviews/                — DLQ settlement reports
dream/dream.lock              — Dream run 期間互斥（single thread）
```

| | L0 | L1.5 | L2 |
|--|----|------|-----|
| 內容 | 發生了什麼 | Dream **當時認為**該怎麼整合 | **當前**語意／情節表面 |
| 可變性 | immutable | immutable | Dream apply **與人手改**都可寫 |
| 角色 | 情節真相 | Dream 決策 audit | 活的工作面（非純投影） |

**原則：**

- LLM 只負責提案 patches；機械層負責 schema 校驗、落盤、apply、冪等
- 除錯「為什麼**夢成**這樣」→ 讀 L1.5；「現在相信什麼」→ 讀 L2 Current
- **允許手改 L2**；手改是一等公民
- `dream rebuild`（從 L1.5 重建 L2）：**MVP 不做**；後期若做，標危險（會蓋手改）

---

## 執行模型（已定案）— single thread

```
日間：只 Ingest（L0 + L1）
夜間：dream run = extract → apply（失敗進 DLQ，繼續）→ clear L1
         ↑ 同一 process、連跑、不穿插 ingest、不手改 L2
```

| 規則 | |
|------|--|
| 不並行 | 同時只允許一條寫入路徑：Ingest **或** Dream |
| `dream run` | **必須** extract+apply 連跑；MVP **不支援**長時間隔開 |
| 夜間手改 | convention：Dream 期間不手改 L2；持 `dream.lock` 即可 |
| 語意矛盾 | L1 vs L2 打架是常態，不是並發 bug → 見下方「同化」 |

---

## Dream：兩 stage

```
dream-extract  →  append patches.jsonl
dream-apply    →  逐筆寫 L2；失敗 → DLQ，繼續；run 結束 → clear L1
```

### 觸發

- 定時（如每日 23:00，時區 `Asia/Taipei`）
- 手動 `dream run`（= extract + apply）
- MVP 不暴露長時間隔開的 extract／apply；除錯子命令可有

### Stage A — `dream-extract`

1. **Segment** — short-term + 當日 events → memory units  
2. **讀相關 L2 Current** — 與 L1 比對（同化，見下）  
3. **Attribute** — node 歸屬；primary vs mention（含 confidence）  
4. **Extract** — structured patches，**只 append** `dream/patches.jsonl`

- 同 `dream_run_id` 已存在 → 不重複寫  
- **不**寫 nodes、**不**清 L1  
- extract **整段失敗** → L1 保留，可重跑（與 apply 單筆 DLQ 不同）

### Stage B — `dream-apply`（per-patch + dead letter）

1. 取 `dream.lock`  
2. 依序處理本 run 未在 `applied.yaml`、且未在 DLQ 的 patches  
3. **單筆成功** → 寫 L2／candidates；`patch_id` → `applied.yaml`  
4. **單筆失敗** → append `dream/dead-letter.jsonl`（完整 patch + error）；**不停**；處理下一筆  
5. **本 run 處理完所有 patch**（無論有無 DLQ）→ **Clear L1**  
6. 釋放 lock  

```
成功 → applied.yaml + 寫 L2
失敗 → dead-letter（今晚不重試、不擋後續）
其餘 → 繼續
結束 → clear L1
```

**「丟了」的意思：** 今晚這筆沒進 L2；**不是**資料蒸發。

| 仍在 | |
|------|--|
| L0 `event_refs` | ✓ |
| L1.5 原 patch | ✓ |
| pending DLQ | ✓（待 batch review） |
| L2 | ✗ 這筆未寫上 |

已 `applied` 跳過。**不做**失敗即停、**不做**整 run rollback。  
人審與恢復 → 下方 **DLQ review**（不做單筆機械重試為主路徑）。

---

## DLQ review（已定案）

夜間失敗不逐筆 `apply --patch-id` 重跑。改為：**一批 pending → 人+AI 沉澱 → adhoc dream**。

```
選 scope（dead_letter_ids）
  → User + AI：settlement report（或 discard / 人重申內容）
  → adhoc extract（失敗 → pending 不動，可重跑；不擋主流程）
  → extract 成功 → L1.5 dlq_review + archive scope
  → disposition apply → apply（新失敗 = 新 DLQ append）
```

### Settlement report

- 路徑例：`dream/reviews/2026-07-18-dlq.md`
- 內容：這批想怎樣進 L2（或放棄）；可含人重申的原文
- 必列顯式 scope：`dead_letter_ids: [dl-001, …]`

### Adhoc dream vs 夜間 dream

| | 夜間 `dream run` | DLQ adhoc dream |
|--|------------------|-----------------|
| 輸入 | L1 + 當日 events | **report**（+ 可選人重申）；仍讀 L2 Current 同化 |
| 清 L1？ | ✓ | **✗ 絕對不清** |
| lock | ✓ | ✓（仍 single thread） |
| 成功／失敗 | 常規 applied / DLQ | extract 成功才 archive；apply 失敗 → 新 DLQ |

### Pending 清理

**規則：僅在 adhoc extract 成功之後，才把 scope 移出 pending → archive。**

| adhoc 結果 | pending scope | 其他 |
|------------|---------------|------|
| extract **整段失敗** | **保留不動** | 可重跑 adhoc；Activation 仍可 `dead_letter_pending`；**不影響**夜間主流程 |
| extract 成功 + disposition `apply` | → archive | 再跑 apply；新失敗 = **新** DLQ append |
| extract 成功 + disposition `discard` | → archive | 不 apply（或空 apply） |

1. extract 成功後，L1.5 先記 audit：

```yaml
type: dlq_review
dream_run_id: adhoc-dlq-2026-07-18
consumed_ids: [dl-001, dl-002]
report_ref: dream/reviews/2026-07-18-dlq.md
disposition: apply | discard
```

2. 然後才：scope 內每條 **移出** pending → `dead-letter-archive/`  
3. apply 若再失敗 → **新** `dl-…` append（不清回已 archive 的舊條）  
4. extract 失敗 → **不**寫 `dlq_review` consume、**不** archive；人修 report 後再跑

> Adhoc 卡住（extract 失敗、pending 仍在）可接受：不擋日間 Ingest、不擋夜間 `dream run`。

### 不做

- 默認單筆重試同一壞 patch（可當除錯工具，非主路徑）
- adhoc 清 L1
- **extract 未成功就 archive**（避免 `dead_letter_pending`→`ok` 但 L2 仍有洞）
- 刪除 DLQ 歷史（只離 pending）
- 無 scope 時「清掉檔內全部 pending」

---

## 同化：L1 與 L2 矛盾（已定案）

手改與否無關——白天新事件也可以推翻舊 Current。extract 產出其一：

| 情況 | patch | |
|------|--------|--|
| 補充、不打架 | `semantic` `append` | |
| 明確推翻舊理解 | `semantic` `revise` | 新→Current，舊→History |
| 打不清 | `semantic` 寫入 `open` 或低置信不改 Current | MVP 可先只 what，矛盾時用 revise 或略過 |
| 只是情節 | `episodic` / `chain` | 不動 understand |

不自動辯論式 merge。

---

## MVP apply 範圍（已對齊）

| 級別 | 寫入 |
|------|------|
| **Required** | `nodes/{id}/understand/what.md`；`memory-chain/days/YYYY-MM-DD.md`；L1.5 |
| **Required** | `candidates/nodes.yaml`、`candidates/attribution.yaml`（提案佇列，不建 `nodes/`） |
| **Optional**（同 sprint 可做） | `nodes/{id}/chronology/recent.md`（primary） |
| **不做（MVP）** | 其他 facet；week/month/year；`graph/links`；`reattribute` **apply**；自動建 node；rebuild |

週／月關帳 = 後期獨立 job。見 [memory-chain.md](./memory-chain.md)。

---

## Patch schema（草案）

磁碟格式：**JSON Lines**（每行一個 JSON object）。下文用 YAML 僅便於閱讀。

共用欄位：

```yaml
patch_id: p000042
dream_run_id: dream-2026-07-18
ts: "2026-07-18T23:10:00+08:00"
event_refs: [e041, e042]      # 幾乎必填；noise 除外
```

### 類型

```yaml
# semantic（MVP：僅 facet what）
type: semantic
node: acme
facet: what
operation: append | revise | resolve_open
content: "..."

# episodic
type: episodic
node: acme
role: primary | mention
confidence: 0.0..1.0          # < 0.6 → attribution candidate；正文先當 mention
date: 2026-07-14
content: "..."

# chain（MVP：僅 day）
type: chain
level: day
id: "2026-07-14"
content: "..."

# 新建 node：只提案
type: propose_node
proposed_id: "..."
kind: org
aliases: []
reason: "..."
evidence_event_refs: []
seed_facets: { what: "..." }
# apply → upsert candidates/nodes.yaml（當前狀態以 yaml 為準）

# ── MVP 不 apply ──
# type: reattribute
# type: link
# type: restructure | strengthen_link | merge_node

# DLQ review audit（adhoc 開始時寫入 L1.5）
type: dlq_review
consumed_ids: [dl-001]
report_ref: dream/reviews/...
disposition: apply | discard
```

### `reattribute`（MVP）

- **不做 apply**（不改 `chronology/recent.md`、不改 day chain）
- 低置信只進 `candidates/attribution.yaml`
- 人把 `status` 改成 `resolved`（手改 yaml）；L1.5 若有筆記僅供 audit
- 後期再定義 forward-fix apply

### candidates source of truth（已定案）

| 資料 | 誰為準 |
|------|--------|
| `candidates/*.yaml` **當前狀態**（pending / approved / rejected / resolved） | **yaml** |
| 「當時為何提案」 | L1.5 `propose_node` patch |
| 批准後建 `nodes/{id}/` | 人（或工具），非 Dream 自動 |

手改 yaml 與舊 patch replay：**以 yaml 為準**；不因 replay 覆蓋人的批准／拒絕。

---

## 遺忘

- short-term：本 run **apply 階段跑完**後清空（含部分進 DLQ 的情況）  
- chronology 歸檔、mention 節流：見 [nodes-chronology.md](./nodes-chronology.md)  
- noise 不進 L2  
- L0、L1.5 永遠保留  

---

## 規則 vs LLM

| 步驟 | 規則 | LLM |
|------|------|-----|
| L0 / L1.5 append | ✓ | |
| schema、per-patch 冪等、lock、清 L1 | ✓ | |
| L1 分流 | 關鍵字 / node_refs | 可選 |
| attribute & extract（含 vs Current） | | ✓ |
| understand revise 文案 | | ✓ |

**MVP：** Ingest 全規則 + extract 一次 LLM + apply 全規則；single-thread `dream run`。
