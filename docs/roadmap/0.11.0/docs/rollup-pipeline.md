# 0.11.0 — Rollup 管線（planner → writer → draft → approve）

← [INDEX](../INDEX.md) · 推理：[reasoning.md](./reasoning.md) · 路徑：[store-layout.md](./store-layout.md)

> **實作契約：** dream 在既有 day extract 之後如何串 week／month／year。  
> **勿**把高階摘要塞進現有 day `extract.md` 同一輪產出。

---

## 總流程（單一 dream_run）

```
POST /dream/run
  │
  ├─ 1. 既有：day extract（nodes / day chain / future / …）
  │         → materialize day（與現況相同）進 draft
  │
  ├─ 2. Week：
  │      planner(week)  → { run: Y/N, ids[], reasons }
  │      若 Y：對每個 id → writer(week) → draft 寫 weeks/…/*.summary.md
  │
  ├─ 3. Month：
  │      planner(month) → 同上（context 須能讀到本輪 week draft）
  │      若 Y：writers → draft months/…
  │
  ├─ 4. Year：
  │      planner(year)  → 同上（context 須能讀到本輪 month draft）
  │      若 Y：writers → draft years/…
  │
  └─ 5. pending_review（同一個 dream_run_id）
         report 含 day + 高階 init/revise 列表
         approve → commit 全部 draft（含高階 replace）
         discard → 全丟；initialized_* 不更新
```

鎖與取消：延用現有 dream lock／`POST /dream/cancel`；取消須清掉已 materialize 的高階 draft。

---

## 候選 id 的機械推導（planner 輸入）

對每一層 `week`｜`month`｜`year`：

```
candidates =
  (本輪 touched day → 所屬期間)
  ∪ (磁碟掃描：已結束、下層有內容、缺 higher summary)
```

然後 **剔除** 所有仍開著的當週／當月／當年（`is_current_period`）。開著期間 **永不** 進入 targets（server 硬規則，不只靠 prompt）。

下層「有內容」：week＝至少一日有 day summary；month＝有 week summary 或該月 day summary；year＝有 month summary 或該年 day summary。無下層的空窗不造空殼。

**執行（server `enforceRollupPlan`）：**

| 狀態 | 行為 |
|------|------|
| 開著 | 已剔除 |
| 已結束 + 缺檔 | **必** init（planner 不可否決） |
| 已結束 + 已有檔 + 本輪 touched 落在該期間 | revise |
| 已結束 + 已有檔 + 本輪無關 | 不碰 |

Planner 可提供 reason；**不可**發明候選外 id，也**不可**讓開著期間通過。明示工程全掃仍用 `bun run chain:backfill`。

（舊約曾只從本輪 day 推候選、且「開著不寫」僅 prompt Prefer——會 miss 上週／隔週補建，且 agent 可誤 init 當週。）

---

## Planner 契約

### 職責

- 對已篩過的 **closed** 候選給 reason（可選略過無關已有檔）。
- 產出 JSON：`execute`、`targets[]`（server 會再 `enforceRollupPlan`）。

### 禁止

- 產出 summary 全文、markdown Current、或「改寫後內容」。
- 讀壁鐘；必須用與 extract 相同的 `today`／`now`（虛擬時鐘）。
- 發明候選外 id；對開著期間 init／revise（server 會剔除／校驗失敗）。

### 輸出 JSON schema（建議形狀）

```json
{
  "level": "week",
  "execute": true,
  "targets": [
    { "id": "2026-W26", "operation": "revise", "reason": "backfill day 2026-06-29" }
  ]
}
```

- `execute: false` → 忽略 `targets`，不跑 writer。
- `operation`：`init`｜`revise`（須與磁碟／initialized 狀態一致；不一致則機械校驗失敗 → dream_incomplete 或跳過該 id 並記 report 錯誤——選一種並在實作中固定，建議：**校驗失敗令整輪 materialize 失敗** 較易測）。

---

## Writer 契約

### 職責

對 planner 給定的 **每個 id**：

1. 判定 init vs revise（檔案／initialized）。
2. 組裝 **下層 context**（見下表）。
3. 呼叫 AI 產 **完整新 Current 正文**（不要只產 diff）。
4. Materialize 進 **draft**（與 day summary 相同：approve 才進 live）。

### 下層 context

| Writer | 必讀 | 可選 |
|--------|------|------|
| week | 該週每日：summary Current；無則 ledger fallback | 現有 week Current（revise 時） |
| month | 與該月日期重疊的各 week：summary Current；**若某重疊 week 尚無 summary**，fallback 讀那些天的 day summaries | 現有 month Current；**本輪 draft 中已更新的 week** |
| year | 該年各 month summary Current；缺月則跳過或標 missing | 現有 year Current；**本輪 draft 中已更新的 month** |

讀 draft 覆蓋 live：串聯時上層 writer 必須 **prefer 本 dream_run draft**，否則串聯無意義。

### 寫入 draft

- 路徑對齊 [store-layout.md](./store-layout.md)。
- Manifest 追蹤 create／update。
- Approve：live **replace** summary 檔（init＝copy 新檔；revise＝覆寫 Current；高階**無** History）。
- **不要**對 week／month／year 做 ledger append。

---

## 與 day 管線的邊界

| | Day（既有） | Week／Month／Year（本版） |
|--|------------|---------------------------|
| Patch type | `type: chain`, `level: day`（可繼續） | **建議** 獨立內部產物／manifest 條目；若擴 `level` 必須同步 schema、parsePatch、report——不可靜默忽略 |
| Ledger | 有 | **無** |
| Extract prompt | `server/prompts/extract.md` | **新** prompts（如 `rollup-plan-week.md`、`rollup-write-week.md`…） |
| 人審 | 既有 day／nodes | Report 增段落；UI 至少顯示高階變更列表（detail 可後續加強） |

若採「高階也寫入 `patches.jsonl`」：每筆須可機器 apply；欄位至少 `level`、`id`、`summary`、`summary_operation`。  
若採「不算 patch、只算 draft 檔 + report」：approve 仍須原子；L1.5 追溯要有等同紀錄（寫 `dream/reports/…` 或旁路 json）。**擇一寫進實作並更新 api-docs**；預設建議 **擴充 chain patch `level`** 以利追溯，但 day extract **不得**順便產 week／month／year（仍由獨立 planner／writer 產這些 patch）。

---

## Backfill（驗收與 data-demo）

除「夜間 dream 增量」外，須提供 **工程用** 回填手段（擇一或組合，須文件化）：

- CLI：例如 `bun run chain:backfill -- --level=month --until=2026-07`  
  對已有 day summaries 的過去區間跑 planner＋writer（可強制 execute）；或
- 文件說明：用虛擬時鐘 + 對空 L1 的專用 backfill dream（較扭，不優先）。

`data-demo`：遷移 day 分組後，應能 backfill 出合理的 week／month／year，供 Memory browse 驗收。

---

## 測試要點（self-test／phases）

1. 僅 day 變更且 planner N → live 高階不變。
2. 跨月後 dream → 上月 month init／revise。
3. Month 已 initialized → 補記舊 day → month revise（Current 反映補記），**不是**跳過。
4. Discard → 高階 live 不變、initialized 不新增。
5. Cancel 於 week writer 之後 → draft 清除、live 不變。
6. Track 0：舊 flat day 遷移後 browse／search 仍綠。

Mock agent：為 planner／writer 提供 mock，避免 CI 依賴真實 CLI agent。
