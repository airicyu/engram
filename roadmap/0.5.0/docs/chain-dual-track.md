# Memory-chain 雙軌 — ledger + summary

← [0.5.0 INDEX](../INDEX.md)

## 動機

現行 `chain` patch 對 `memory-chain/days/{id}.md` **僅 append** patch block。同日多次入夢、補記 occurrence 日時，檔案會堆疊多塊，Recall 噪音高；但全改 revise 又會失去稽核鏈。

**定案：兩軌並存。**

| 軌 | 檔案 | 語意 | 寫入 |
|----|------|------|------|
| **Ledger** | `days/{YYYY-MM-DD}.md` | 「哪次入夢寫了什麼」 | append-only block |
| **Summary** | `days/{YYYY-MM-DD}.summary.md` | 「那天世界發生了什麼」（可讀敘事） | extract 融合 → approve 機械 revise |

## 目錄佈局

```
memory-chain/days/
├── 2026-07-22.md           # ledger
└── 2026-07-22.summary.md   # summary
```

- `id`（patch `chain.id`）= occurrence day `YYYY-MM-DD`（`ENGRAM_TZ`，預設 Asia/Hong_Kong），與 0.3 world timeline 一致。
- Summary 檔名固定 `{id}.summary.md`，與 ledger 同目錄。

### Ledger 格式（不變）

```markdown
# 2026-07-22

<!-- patch:p006 -->
### patch:p006 · events:[e000002, e000003]

…incremental block content…
```

### Summary 格式（對齊 L2 what.md）

```markdown
## Current

…融合後的當日敘事…

## History

### 2026-07-22 · patch:p006 · events:[e000002, e000003]

…上一版 Current（revise 時沉入）…
```

- `init`：建立檔案，只寫 Current（History 可空）。
- `revise`：舊 Current → History（帶 patch stamp），新 `summary` 成 Current。

## Patch schema（擴充 `type: chain`）

在現有欄位上 **新增**（breaking for extract agent；舊 patch 無 summary 欄位者僅寫 ledger，summary 不動——僅過渡；新 extract 必帶）：

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `content` | string | yes | → **ledger** block 增量文字 |
| `summary` | string | yes | → **summary** 新 Current 全文（已融合舊 Current + 本輪事實） |
| `summary_operation` | string | yes | `"init"` \| `"revise"` |

既有欄位不變：`patch_id`, `dream_run_id`, `ts`, `level: "day"`, `id`, `event_refs`.

### 範例

```json
{
  "patch_id": "p006",
  "dream_run_id": "dr-…",
  "ts": "2026-07-22T22:00:00+08:00",
  "event_refs": ["e000005"],
  "type": "chain",
  "level": "day",
  "id": "2026-07-22",
  "content": "Evening meal: 大家樂烔豬扒飯。",
  "summary": "Engram shipped 0.4.0. Evening meal: 大家樂烔豬扒飯. Playing 碧藍幻想Relink.",
  "summary_operation": "revise"
}
```

- **不**拆成兩種 patch type（維持一筆 chain = 同一 occurrence 日的一次結晶）。
- 同一 run 多個 `chain` patch（不同 `id`）各自更新對應日的 ledger + summary。

## Dream 流程

```
extract (AI)
  ├─ 讀 L0/L1 scope、l2_current、chain_summaries_current[day]
  ├─ 可選：chain_ledger[day]（debug／人審）
  └─ 產出 chain patches（content + summary + summary_operation）

materialize (機械)
  ├─ applyChainLedgerToDraft   → days/{id}.md append block
  └─ applyChainSummaryToDraft  → days/{id}.summary.md init/revise

pending_review → 人審 report + draft（UI 預設顯示 summary diff；ledger 可折疊）

approve / commitDraft (機械)
  └─ 原子 copy draft → live；**不**呼叫 AI
```

### Extract 規則（prompt 要寫死）

1. `summary` 必須是**融合後**的整日敘事，不是只重複 `content`。
2. 有既有 summary Current → `summary_operation: "revise"`，新 summary 吸收舊文 + 本輪 L1 事實。
3. 該日尚無 summary 檔 → `summary_operation: "init"`。
4. `content`（ledger）保持**增量**、可較碎；不必與 summary 字面上相同。
5. 未來日仍 **禁止** `chain.id`（`future_chain_id` 不變）。

## Materialize 行為

### Ledger（現 `applyChainToDraft`）

- 邏輯不變：marker 冪等、append block。

### Summary（新 `applyChainSummaryToDraft`）

- 讀 draft → live → empty 的 summary。
- `init`：寫入 `## Current\n\n{summary}\n\n## History\n`。
- `revise`：若無 Current section，視同 init；否則舊 Current 加 stamp prepend 到 History，寫新 Current。
- manifest 追蹤 `memory-chain/days/{id}.summary.md`（`create` / `update`）。

## Recall

`GET /recall` 的 `chain` 區塊：

1. 讀 `readDaySummary(day_id)`。
2. 若 summary 空／不存在 → **fallback** `readDay(day_id)`（ledger，過渡期）。
3. **不**注入 ledger 當 summary 與 summary 同時存在。

可選後續：`chain.source: "summary" | "ledger_fallback"` 供 UI 標示（非 MVP 必須）。

## 手改政策

- User **可以**直接編輯 `*.summary.md`（與 L2 手改類似）。
- 正常變更路徑：**僅 dream → approve**。
- **不**實作鎖或衝突偵測；user 自行避免在 dream lock／pending 期間手改同一檔。
- 下一輪 extract 讀到的是**手改後**的 Current，AI 應在其上 revise。

## 遷移

| 現況 | 0.5.0 後 |
|------|----------|
| `days/2026-07-22.md` 存在 | 視為 **ledger**，路徑不變 |
| 無 `.summary.md` | 合法；Recall fallback ledger；下次 dream 對該日 `init` summary |
| 一次性 backfill | 可選腳本：讀 ledger blocks → 單次 extract 或人工寫 summary（非必須） |

## API／status 調整（草案）

| 項目 | 變更 |
|------|------|
| `GET /recall` | `chain.content` 來自 summary（fallback ledger） |
| `GET /dream/pending` `draft_summary` | 可增 `chain_summary_days: string[]`（或合併進 `chain_days` 並文件註明） |
| Report | Proposed chain 區塊顯示 summary 摘要（ledger 折疊） |
| `api-docs/api.md` | Patch table + 雙檔路徑 |

## 測試要點

- 單日 init：ledger create + summary create
- 同日第二次 patch：ledger 兩 block；summary 一次 revise、History 有一條
- 跨日一 run 多 chain：各日 ledger/summary 獨立
- `future_chain_id`：summary 路徑亦 blocked
- Recall：有 summary 不讀 ledger；僅 ledger 時 fallback
- Supersede／discard：draft 含 summary 路徑一致

## 與後期 week rollup 的關係

Week/month 關帳應讀 **`*.summary.md`** 列，不掃 ledger patch blocks。本版不實作 rollup。
