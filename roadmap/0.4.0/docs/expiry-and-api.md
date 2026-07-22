# 未來視 — 過期與讀取

← [0.4.0 INDEX](../INDEX.md) · 依賴 [store-and-patch.md](./store-and-patch.md)

## 過期條件

以 Asia/Taipei **日曆日** `today`：

- 若 `today > anchor_end` → 該活錨點 **已過期**
- 區間內（`start ≤ today ≤ end`）仍視為活

## 過期動作（已定）

對每個過期活檔，順序：

1. **Mark event** — 寫入一筆 **L0**（`log/events.jsonl`），並進 **L1**（與一般 ingest 同形），留下「此前瞻已過期」的痕跡  
2. **清理** — **硬刪** `future-sight/active/{id}.md`

清掉之後活集合裡**沒有** expired 物件可查——因此 **不做** `GET /future-sight/expired`，也不另建 `expired.jsonl` 當可 query 的架。

### L0 event（最小）

| 欄位 | 例 |
|------|-----|
| `source` | `system/future_sight_expired` |
| `raw` | 短述：錨點 id、原 `anchor_*`、原 content 摘要 |
| `node_refs` | 沿用錨點上的（若有） |
| `ingest_meta` | `{ "future_sight_id": "fs-…", "reason": "past_anchor_end" }` |

之後可經正常 dream 消化（例如寫入當日 memory-chain「某預期已過期」）；是否蒸餾由人審決定，未來視目錄本身不再留屍。

## 誰觸發（本版）

**懶掃（lazy sweep）**，不設獨立 cron：

| 觸發點 | 行為 |
|--------|------|
| `GET /future-sight` | 先 sweep（event + 刪檔），再回**活**清單 |
| `POST /dream/approve` 成功後 | 建議順便 sweep |
| `GET /status` | 可選 `future_sight_active_count` |

**本版不做：** 過期 cron、到期推播、`GET /future-sight/expired`、Recall 注入／因 Recall 而 sweep。

## HTTP API（本版）

| 方法 | 路徑 | 行為 |
|------|------|------|
| `GET` | `/future-sight` | sweep 後回活錨點；**200**；無則 `anchors: []` |

### `GET /future-sight` 200

```json
{
  "anchors": [
    {
      "id": "fs-2026-07-31-deadline",
      "anchor_start": "2026-07-31",
      "anchor_end": "2026-07-31",
      "content": "Deadline；與旅行可能撞期。",
      "node_refs": ["acme"]
    }
  ],
  "swept_expired": ["fs-2026-07-20-old"]
}
```

`swept_expired`：本次請求剛清掉的 id（僅告知「剛 sweep 了誰」；**不是**提供 expired 庫查詢）。之後要追溯過期內容 → 查 L0／後續 dream 結果，不是 future-sight API。

## Consolidate／UI

沿用 dream report 的 Proposed future-sight + Approve。  
Web Recall **不**展示未來視。可選 status 活躍筆數。

## 與 dream 閘門

| 不變 | |
|------|--|
| 未 approve | 不寫 `future-sight/active/` |
| Draft | 可預覽擬寫入錨點 |
| Discard／supersede | 丟 draft；不動已 commit 活錨點 |
| 人審 | 唯一寫入未來視之門 |
| 過期產生的 L0／L1 | 系統寫入；不經 approve（過期是時間推進，不是新前瞻主張） |
