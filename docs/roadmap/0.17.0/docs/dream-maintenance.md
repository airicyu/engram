# 0.17.0 — 入夢前機械維護 ＋ AI 內容維護

← [INDEX](../INDEX.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫時間線與責任邊界 **HOW**。

## 兩步模型

```
POST /dreams/run
  ① maintainFutureSight(mode=full)（純 script，無 AI）
       過期刪 → 出窗移出 → 依 T 重桶 hot／later → 排序寫回
       若 memories/future-sight/*.md 或相關 event／pool 有變更
         → git commit（message 前綴：`engram: future-sight maintain`）
  ② 既有 0.16 入夢：lock → draft 工作樹 → agent 改檔＋report → pending_review

人審 approve
  → 對 draft 內 hot.md／later.md **必跑** maintainFutureSight(mode=full, target=draft)
       （校正 AI 分錯區／未排序；不寫 L0——draft 上的過期項改走 409，見下）
  → 若仍有 item `anchor_end < today` → **409** `stale_future_anchor`＋ids；pending 保留
  → deletes → deploy → git commit（message 含 dream_run_id）
  → **Deploy 後不強制**再 maintain

人審 discard
  → 丟 draft／pending；**不**回滾①已落地的維護 commit
```

**過期／出窗清除不經 approve。** 內容加減改（含主動取消錨點）經 draft＋approve。

---

## ① 機械維護（必須無 AI）

### 何時呼叫（已鎖定）

| 時機 | 過期清＋event | 出窗＋event | 重桶 | 排序 | git commit |
|------|---------------|-------------|------|------|------------|
| `POST /dreams/run` 開頭（agent 前） | ✓ | ✓ | ✓ | ✓ | 有變更則 ✓ |
| `GET /memories/future-sight` | ✓ | ✗ | ✗ | 寫回保持序 | 有過期清除則 ✓ |
| `POST /dreams/approve` deploy **前**（對 **draft** 兩檔） | 發現過期 → **不**靜默刪改寫 live event；改 **409** | 出窗項移出 draft 或併入 409 策略：**本版對 draft 過期＝409；draft 出窗＝script 移出兩檔（不寫 L0，因尚未 live）** | ✓ | ✓ | 否（稍後併 dream commit） |
| Deploy 後 | ✗ 不強制 | ✗ | ✗ | ✗ | — |

**GET 禁止重桶。** 過期硬清後若改了 tracked 檔 → 維護用 commit（與入夢前同一 message 前綴）。

### Event 契約（已鎖定）

| 情況 | `source` | `ingest_meta.reason` |
|------|----------|----------------------|
| `anchor_end < T` | `system/future_sight_expired` | `past_anchor_end` |
| 出窗移出 | `system/future_sight_expired` | `out_of_window` |

其餘欄位對齊 0.4：`raw` 短述、`ingest_meta.future_sight_id` 等。僅 **live** 機械維護寫 L0＋short-term；draft 上的整理不寫系統 event。

### 實作要點

- **一個** store 函式 `maintainFutureSight`，參數區分 `mode: full | expire_only` 與 `target: live | draft`。
- **禁止**呼叫 AgentRunner。
- Commit message 前綴固定：`engram: future-sight maintain`（不可冒充 `dream_run_id` 人審結果）。

### 與 lock 的關係

- 入夢前維護在 dream lock 內、agent 前。
- 維護失敗 → 整次 `POST /dreams/run` 失敗；不要半套進 agent。

---

## ② AI 內容維護（extract）

Agent 在 draft 中：

1. **Script copy** live `hot.md`／`later.md`（若需改）進 draft。
2. 依本輪 events：對既有 id **update／delete**；對新近程可錨定 **add**；**按 `T`＋config 寫入正確檔**。
3. **不得**把 `anchor_start > T+window_days` 的項寫進兩檔。
4. Report：Near future 說明加／改／刪；Appendix 列出兩 path（若有動）。

**旁觸不改。** Approve 前 server **必跑** draft full maintain，因此分錯區／未排序可由 script 校正；AI 仍應盡力一次寫對。

---

## Discard 語意

① 已 commit 的過期／出窗／重桶 **保留**。  
Discard 只取消尚未批准的 AI 內容變更。Workbench／api-docs 須寫明。

---

## API 表面（出貨寫入 api-docs）

### `GET /memories/future-sight`

```json
{
  "anchors": [
    {
      "id": "fs-…",
      "zone": "hot",
      "anchor_start": "2026-08-01",
      "anchor_end": "2026-08-01",
      "content": "…"
    }
  ],
  "swept_expired": ["fs-…"]
}
```

- `anchors`：先 hot 再 later；各區內近→遠。
- `swept_expired`：本次請求剛過期清除的 id（不含出窗——GET 不做出窗）。

### `GET /status`（已鎖定）

| 欄位 | 意義 |
|------|------|
| `future_sight_active_count` | 兩檔 item **總數**（相容舊欄位名） |
| `future_sight_hot_count` | `hot.md` item 數 |
| `future_sight_later_count` | `later.md` item 數 |

### Dream run

- 可選在 response／report 提及本 run 前維護清除／搬移的 id；非 UI 硬需求。
