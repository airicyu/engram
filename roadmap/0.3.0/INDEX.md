# 0.3.0 — Dream approve + 基本時間線

← [changelog](../../changelog.md) · current: [version](../../version.md) · 下游：[0.4.0 未來視](../0.4.0/INDEX.md)

> **狀態：** **已實作（0.3.0）** — 見 `version.md`／`changelog.md`。  
> **本版做：** dream 人審閘門、L1.5 draft staging、L1 mem pool（按 event 範圍清）、occurrence／encoding（**world timeline**）。  
> **本版不做：** 未來視 chain → [0.4.0](../0.4.0/INDEX.md)（做法留白，完成後再討論）。

## 產品句

> Dream 先產出可讀報告、patches 意圖與 **draft 投影**；人審滿意後 `approve` 才 **原子 commit** 至 L2；L1 按本輪 event 範圍清理；補記可寫回「發生日」的 memory-chain，而不是永遠貼在 ingest 日。

## 為何要有這版

現行 `dream/run` = extract → 立刻 apply → 整包清 L1。實際問題：

1. AI 對日期／事實的判斷未經人審就進 L2。
2. 補記／回想（今日寫入、內容指向過去）被當成「今日發生」。
3. 白日夢／pending 期間仍會 ingest，但 L1 無法按範圍清，一清就誤刪新活動。
4. 文中未來日（deadline）若寫進 memory-chain 未來檔名，會與真正的「已發生回憶」混淆，並擋死 0.4 未來視。

## 文件地圖

| 文件 | 內容 |
|------|------|
| [dream-approve.md](./dream-approve.md) | extract → report + patches → approve；supersede；API |
| [l1-mempool.md](./l1-mempool.md) | L1 = mem pool；按 L0 event id 索引；凍結 S；只清 S |
| [timeline.md](./timeline.md) | occurrence vs encoding；memory-chain 只寫已發生；未來日禁止入 chain |
| [design-review.md](./design-review.md) | 設計審查：必須補的洞、中高風險、建議定案條文 |

**依賴：** 時間線 backfill 依賴 approve commit；pending 可 ingest 依賴按 S 清 L1。

## L1.5（0.3 重新定義）

| 層 | 路徑 | 角色 |
|----|------|------|
| **intent** | `dream/patches.jsonl` + `dream/reports/{id}.md` | extract 結構化意圖；可審計、餵 report |
| **draft** | `dream/draft/{dream_run_id}/` | `materialize(patches)` 的 L2 投影 + `manifest.yaml` |
| **run 狀態** | `dream/runs/{id}.yaml`（或等價） | `pending` \| `committed` \| `superseded` \| `discarded` |

**不變式：** approve 前 **不寫 L2**；`approve` = 原子 `commitDraft`。**廢除** per-patch 即時 apply 與 `applied.yaml`（per `patch_id`）作為主冪等機制。

## 已定案（2026-07-19）

| # | 題 | 決定 |
|---|-----|------|
| 1 | Pending 改寫 | **新 run 取代（supersede）**，不原地修同一批 pending |
| 2 | Approve commit | **`commitDraft`** → L2（同行程失敗盡力 rollback；崩潰見 **#26**）；全成功才清 S；失敗則 **L2 不變**、L1 全留（含 S）、可重試 `approve` |
| 3 | Pending 期間 ingest | **允許**；新 event ∉ 本輪凍結 S |
| 4 | L1 結構／清理 | 可按 **L0 event id** 索引；dream 凍結 **S**；approve 成功 **只刪 S** |
| 5 | Review 時改記憶 | 只經 supersede／approve／discard；**禁止** skill 直接改 L1／L2（防錯亂與 leak） |
| 6 | 未來視 | **整包 → 0.4.0**；0.3 不建庫、不設計做法細節 |
| 7 | 未來日 vs memory-chain | **禁止** `chain.id` = 未來日當 occurrence；report 可標「Future mentions」 |
| 8 | Memory-chain 語義 | **A — world timeline**：`days/D` = 發生日（已發生）；補記寫回 occurrence 日，不是 journal |
| 9 | Pending 時再 dream | **直接 supersede**（丟舊 pending，新 extract）；不必先 discard |
| 10 | 同時幾個 pending | **只准一個**；再 run = supersede 取代該唯一 pending |
| 11 | Extract 預設 S | **呼叫當下整個 pending pool** |
| 12 | API「無資料」 | **禁止用 404 表示沒有資料**；回 **200** + body 空表示 |
| 13 | HTTP API | 見下方「已 lock 的 API」；取消 run 自動 apply／resume apply |
| 14 | L1.5 執行模型 | **D — draft staging**：intent + draft 投影；取代 per-patch 直寫 L2（見上表） |
| 15 | Extract 輸入 | = S 對應的**跨日** L0 event + L1 視圖 + 既有 L2；廢除「僅今日 events」 |
| 16 | 未來日校驗 | **approve** 當下 Asia/Taipei 日硬擋未來 `chain.id`；extract 同規預檢 |
| 17 | Consolidate | 0.3 出貨：**最小面** — pending 時顯示 report 摘要 + Approve／Discard（Run 文案改 Extract） |
| 18 | 同日 encoding | occurrence 日 = encoding 日時**只寫 occurrence**；encoding meta 僅在兩日不同時 |
| 19 | 空 pool | L1 空或 S=[] → `POST /dream/run` 回 **409** `nothing_to_dream` |
| 20 | Run 生命週期 | 唯一 `pending` run；supersede／discard 標記舊 run；`GET /dream/pending` 只回 active pending |
| 21 | 新 node 與 draft | Dream **可直接 create live node**：`propose_node`（或等價）→ `draft/…/nodes/{id}/`（含 seed），approve 隨 commit 落地。同 run 可對該 id 寫 semantic／episodic（#30）。**廢除**「新 node 只進 candidates、另開人審建 node」。低信心 **attribution** 仍可進 `candidates/`（歸屬不確定 ≠ 建 node 閘門）。膨脹 → 後續 **merge**（人判、AI 執行）；**0.3 不做 merge** |
| 22 | Materialize 失敗 | 不進 `pending_review`；async job `failed` + `phase: materialize`；清不完整 draft；L1 不動 |
| 23 | `manifest.yaml` | 見下方「manifest 最小 schema」；0.3 **僅** `create`／`update`，不支援 delete |
| 24 | Run 狀態真相來源 | **`dream/runs/{id}.yaml`** 為準；`patches.jsonl` 僅 audit append，不當 pending 判斷 |
| 25 | Materialize 順序 | 依 patches 陣列順序；同 run **整目錄重寫** draft；**須**先 create 本 run 新 node，再寫該 id 的 what／episodic |
| 26 | `commitDraft` 崩潰安全 | **可接受風險**：行程內失敗盡力 rollback；kill／斷電不保證跨檔原子。復原靠 **daily backup** 或把 data（`ENGRAM_HOME`）納入 **git**；日後可 config 外部 data folder 以便用 git 管理／備份。**0.3 不做** journal／commit-staging 檔案協定 |
| 27 | Commit 後清 S 失敗 | **B1**：先 commit 再清 S。commit 成功即標 run `committed`；清 S 失敗 → `l1_clear_pending`（或等價）；`POST /dream/approve` 再呼叫 = **只重試清 S**；`/status` 暴露此態。禁止在欠清 S 時當未處理 pending 去 supersede 重蒸餾同批 |
| 28 | Approve 擋未來 `chain.id` | **C1**：`409` `future_chain_id` + `rejected_chain_ids`；**pending／draft／L1／L2 不動**；可稍後再 approve、supersede 或 discard。不自動 strip／不自動 discard |
| 29 | 空 patches、非空 S | **D3**：可進 `pending_review`（report 註明無擬寫入）；`approve` = **不寫 L2**，仍 **清 S**（人確認：無可 distill → discard 短期）。Consolidate／report 須明示「批准將清除本輪 L1、無長期寫入」 |
| 30 | 同 run 新 node + 記憶 | **允許**：一場夢可同時建立 node 與相關記憶。Materialize：本 run create 的 id 在 draft 內已存在；指向「live 無、本 run 未 create」→ fail。人審 = 整場 dream `approve`（含新 node）。過度建 node → 後續 merge；0.3 靠 report 審＋supersede／之後手動 merge |

### manifest 最小 schema（#23）

`dream/draft/{dream_run_id}/manifest.yaml`：

```yaml
dream_run_id: "dream-20260719-…"
materialized_at: "2026-07-19T12:00:00+08:00"
entries:
  - op: create
    path: nodes/alice/understand/what.md
  - op: update          # create | update（0.3 無 delete）
    path: nodes/foo/understand/what.md   # 相對 ENGRAM_HOME
  - op: create
    path: memory-chain/days/2026-07-17.md
  - op: update
    path: candidates/attribution.yaml   # 僅低信心歸屬等；非「待建 node」主路徑
```

`commitDraft`：依 `entries` 將 `draft/{run_id}/` 內對應檔複寫至 ENGRAM_HOME；**同一行程內**任一步失敗則盡力 rollback 本輪已寫入的檔案，L2／candidates 維持 commit 前狀態。跨行程崩潰（kill／斷電）見已定案 **#26**（不靠檔案 journal；靠 backup／git）。

### Materialize 失敗時（#22）

| 項目 | 行為 |
|------|------|
| `dream_status` | 維持 commit 前狀態（如 `ok`），**不**設 `pending_review` |
| `dream_job`（async） | `status: failed`，`phase: "materialize"`，`error: "…"` |
| draft 目錄 | 刪除或不留殘缺 `manifest` |
| L1／L2 | 不動 |

Extract 失敗：`phase: "extract"`，同上。

## 已 lock 的 API

| 方法 | 路徑 | 行為 |
|------|------|------|
| `POST` | `/dream/run` | **extract** → materialize **draft** → 唯一 pending（patches + report + S）；已有 pending → **supersede**；L1 空 → **409**；**async 202**；**不**寫 L2 |
| `GET` | `/dream/pending` | **一律 200**；無 pending → `present: false` 等空欄位（**不用 404**） |
| `POST` | `/dream/approve` | 先校驗未來 `chain.id`（#28：違規 → **409**，pending 保留）。有 draft → **commitDraft** → L2，再清 S。**空 patches**（#29）→ 不寫 L2，仍清 S。清 S 失敗 → `committed` + `l1_clear_pending`，再 approve = 只清 S（#27）。commit 失敗 → L2 不變、L1 全留；sync |
| `POST` | `/dream/discard` | 丟 pending + draft（不動 L1／L2）；sync |
| `GET` | `/status` | 含 `dream_status: pending_review`；含 `dream_pending` 摘要 |
| `POST` | `/ingest` | `pending_review` **可** ingest；僅持 dream lock（extracting／applying）時 **409** |

**`GET /dream/pending` 空狀態（200）：**

```json
{
  "present": false,
  "dream_run_id": null,
  "scope": [],
  "report": null,
  "patches": []
}
```

有 pending 時 `present: true`，其餘填滿；可選 `draft_summary: { "entry_count": N, "chain_days": ["…"] }`（Consolidate 用）。  
`approve`／`discard` body 可空（唯一 pending）；可選 `dream_run_id` 校驗，不符 → 409。  
**取消：** `/dream/run` 自動 apply；「有未 apply patches 就 resume apply」。

實作時同步寫入 `api-docs/`。

## 明確不做（本版）

- 未來視 chain、過期抹除、多尺度未來骨幹、activate 未來視區塊 → **0.4.0**
- 完整 web 審批 UI（0.3 只做 Consolidate **最小面**；細節審批仍可用 skill／curl）
- L1 容量／遺忘策略（本版只做按 S 清）
- Week／month 關帳與 backfill 舊日對已關帳週的細則（可另開）
- Candidates **建 node** 的 web 流（已改為 dream 內直接 create；見 #21／#30）、提醒、日曆 sync
- Node **merge／融合**（人判 + AI 執行；抗膨脹用，另版）
- `/dream/run` 自訂 `event_ids` 子集（預設整池；可後加）

## 給 0.4.0 的預留（實作 0.3 時必須遵守）

1. 不要把未來日寫進 `memory-chain/days/` 當已發生。  
2. Report／extract 區分「有日期錨點的未來提及」與「無錨點純想像」（後者當日事件即可）。  
3. 不要用「把 memory-chain 往未來延長」當作未來視捷徑。  
4. 寫入 L2 繼續走人審閘門（0.4 未來視也不應開野路直寫）。

## 與現行契約對照

| 現行（0.1／MVP） | 0.3.0 |
|-----------------|-------|
| dream 成功 → per-patch apply + 整包清 L1 | run = extract + materialize draft；approve = 原子 commit；成功只清 S |
| L1.5 = patches + per-patch apply | L1.5 = intent + draft；commit 只經 `/dream/approve` |
| `chain.id` ≈ ingest／dream 日 | **發生日**（world timeline）；一輪可多日 patch |
| 無未來日硬規則 | 禁止未來日當 occurrence |

## 建議實作順序

1. L1 改 event 索引 + scope S（預設＝整池）  
2. dream：extract → materialize draft → 唯一 pending；supersede／discard；`commitDraft` on approve  
3. extract 輸入改 S 跨日 L0；prompt：occurrence／encoding；未來日校驗  
4. `/status`、Consolidate 最小面、workbench skill、`api-docs`、changelog／version  

---

**狀態：** implemented — 0.3.0 shipped — 2026-07-21
