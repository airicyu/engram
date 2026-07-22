# Dream approve 閘門

← [0.3.0 INDEX](./INDEX.md)

> 先決流程：在談時間線之前，先改「dream 何時才動 L2」。

## 問題

現行：`POST /dream/run` = extract → L1.5 → **立刻 per-patch apply → clear L1**。  
人無法在寫入前審 AI 對事實／日期的判斷；半失敗還會留下已改過的 L2。

## 目標流程

```
L1 累積（日間 ingest）
    ↓
dream extract
    → L1.5 intent：patches.jsonl + report.md
    → materialize → dream/draft/{run_id}/（L2 投影，未生效）
    ↓
人 review（多輪 = 多次 supersede 重 extract）
    ↓
approve ──→ commitDraft（原子）→ L2 → 只清 L1 中本輪 S → 定案
discard / supersede
    ↓
下一次 dream：丟棄上一 run 的 intent + draft + report
             用**當下 pool** 重新 extract → 新 S'
```

### 關鍵不變式

1. **未 approve ⇒ 不寫 L2、不清 L1。** Ingest 可持續 append L1。
2. **未 approve 的 run 可被 supersede：** 丟棄舊 intent + draft；以當前 L1 重 extract。
3. **Approve 是唯一 commit 至 L2 的門。** `commitDraft` 原子執行；失敗則 L2 不變、L1 全留、可重試。

## L1.5：intent + draft

| 層 | 內容 | 誰寫 | 誰讀 |
|----|------|------|------|
| **intent** | `patches.jsonl`、`reports/{id}.md`、scope S | extract | 人審 report；materialize 輸入 |
| **draft** | `draft/{id}/nodes/…`、`memory-chain/days/…`、`candidates/…`、`manifest.yaml` | `materialize(patches)` | 人可選檢視；`commitDraft` 輸入 |

- **intent** = AI 結構化意圖（語意操作：append／revise／chain…）
- **draft** = patches 套在**現有 L2 + candidates** 上渲染的檔案狀態（唯讀預覽）
- **approve** = 依 `manifest.yaml` 原子寫入 L2

現行 `applySemanticWhat`／`applyChainDay` 語意保留，但目標改為 **draft 路徑**；commit 時一次落地。

## 已定案（2026-07-19）

| 題 | 決定 |
|----|------|
| L1.5 執行模型 | **draft staging**（見 [INDEX L1.5](./INDEX.md#l1503-重新定義)）；廢除 per-patch 直寫 L2 |
| Pending 如何「改寫」 | **supersede**：新 extract + 新 draft；不原地修同一 pending |
| Approve commit 失敗 | **L2 不變**；L1 全留（含 S）；可重試 `approve`；無 L2 半失敗狀態 |
| Materialize 失敗 | job `failed` + `phase: materialize`；不進 pending；清 draft；L1 不動（INDEX #22） |
| Pending 期間 ingest | **允許**；新 event ∉ 本輪凍結 S |
| L1 清理範圍 | 按 L0 **event id 集合 S** 清；見 [l1-mempool.md](./l1-mempool.md) |
| Review 時改記憶 | **只經 supersede／approve／discard**；禁止 skill 直接改 L1／L2／draft |
| Pending 時再 dream | **直接 supersede**；不必先 discard |
| 同時 pending 數 | **只准一個** |

含義：若要改時間線／內容，skill 觸發 **supersede 重夢** 或 `discard` 後再 run；不 PATCH pending patches，也不手改記憶檔。

## Report 要什麼

給人讀的綜合報告（不是只 dump JSON），至少涵蓋：

| 區塊 | 用途 |
|------|------|
| 本輪涵蓋的 L1／event 摘要 | 對齊「夢了什麼」 |
| 擬寫入的時間線（按日） | 人一眼校 occurrence vs encoding |
| 擬改的 L2 what／**新 node（直接 create）** | 語意面；report 應列出本輪新建 id 供人審 |
| Future mentions／不確定項 | 未來日**不**入 memory-chain → [0.4.0](../0.4.0/INDEX.md) |
| 本輪 scope S（event ids） | 與清 L1 範圍對齊 |
| patch 清單（可附 id） | 進階對照 |
| draft 變更路徑摘要（可選） | 對齊 commit manifest |

格式：markdown（`dream/reports/{dream_run_id}.md`）。

## 人機交互

優先：**engram-workbench skill**（或 curl）：

- 讀 pending report（可選看 draft 路徑列表）
- 用人話指出問題 → **supersede 重夢** 直到滿意
- `approve` → 原子 commit；**全部成功才清 L1 中 id∈S**
- `discard` → 丟 intent + draft；L1／L2 不動

Web（0.3 Consolidate **最小面**）：pending 時顯示 report 摘要 + Approve／Discard；Run 文案改 **Extract**。

## 與現行 resume／lock 的關係

| 現行 | 0.3.0 |
|------|-------|
| extract 成功但 apply 未完 → resume | **取消** resume apply；pending = 等 approve 或 supersede |
| dream lock 擋 ingest | lock 只包 extracting／applying；**pending_review 可 ingest** |
| `dream_incomplete` | 拆成：extract／materialize 失敗 vs `pending_review` vs commit 失敗 |

建議狀態：

```
never_dreamed
→ extracting        # extract + materialize
→ pending_review    # intent + draft 就緒；L1 仍在；可 ingest
→ applying          # commitDraft 進行中
→ ok
```

`pending_review` 時再 `POST /dream/run`：**supersede**（丟舊 intent + draft + report）。`discard` = 只丟、不重夢。

## API（已 lock）

| 動作 | 端點 | 行為 |
|------|------|------|
| Extract | `POST /dream/run` | patches + materialize draft + report + S；不寫 L2；L1 空 → 409；已有 pending → supersede；async 202 |
| 讀待審 | `GET /dream/pending` | **200**；無資料 `present: false` |
| 批准 | `POST /dream/approve` | `commitDraft` 原子寫 L2；全成功 → 清 id∈S；失敗 → L2 不變、L1 全留；sync |
| 丟棄 | `POST /dream/discard` | 作廢 intent + draft；L1／L2 不動；sync |

詳見 [INDEX 已 lock 的 API](./INDEX.md#已-lock-的-api)。

**不做**「原地 PATCH pending patches」——改內容 = supersede。  
Pending 必須帶 **scope: event ids**（預設＝呼叫當下整池）。

## 好處

- 未 approve 前 L2 **完全不動**；無 per-patch 半失敗。
- AI 可依整包 L1 推斷多日時間線；人在 report 上校時間。
- draft 可選檢視「落地後長相」，不必 parse patch JSON。

## 開放問題（不擋開工）

1. Report 要不要結構化 section，方便 skill 解析？
2. supersede 是否要可選 confirm 參數？（可後加）
3. draft vs L2 的 diff 是否內嵌 report？（可後加）

## 非目標

- 手改 draft 目錄內檔案
- 把 approve 做成重型 workflow／多人審批
- 必須完整 web 審批 UI 才能 approve
- 自動定時 approve
