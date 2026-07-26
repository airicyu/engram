# Design Review（外部視角評審）

← [INDEX](../INDEX.md)

> 記錄設計張力、已採納決議、與仍待收斂項。  
> 正式規格以 INDEX + 各 `docs/*.md` 為準。

---

## 評審歷程摘要

| 輪次 | 焦點 | 結論 |
|------|------|------|
| 第一輪 | L1.5、MVP 縮小、邊界表 | 方向確立 |
| 第二輪 | L2 手改、per-patch DLQ、single thread、MVP 對齊 | 執行契約成形 |
| 第三輪 | DLQ requeue 略薄、L1 蒸發、幽靈 node | 可開工，convention 待補 |
| **第四輪** | **DLQ review 流程** | **主路徑完整；§1 archive 時機已定** |

---

## 第一輪（2026-07-18）— 已採納

| 原問題 | 決議 | 落點 |
|--------|------|------|
| Dream 過重、無 audit | L1.5；extract / apply | [dream.md](./dream.md) |
| 時間維度重複 | MVP 只做 day | [memory-chain.md](./memory-chain.md) |
| primary/mention | attribution；可錯可改 | [nodes-chronology.md](./nodes-chronology.md) |
| understand 漂移 | Current + History | [nodes.md](./nodes.md) |
| 建 node | candidates；人批准 | [nodes-graph.md](./nodes-graph.md) |
| activation 漏讀 | 誠實狀態欄位 | [activation.md](./activation.md) |
| MVP 過大 | ≤3 node 實驗 | [INDEX.md](../INDEX.md) |

---

## 第二輪（2026-07-18）— 已採納

| 問題 | 決議 |
|------|------|
| L2 vs 手改 | L2 = 活工作面；L1.5 = audit；不做 rebuild |
| apply 部分成功 | per-patch；失敗 → DLQ、繼續；跑完清 L1 |
| extract↔apply | single thread；`dream run` 連跑 |
| MVP 範圍 | Required / Optional 對齊 |
| reattribute | MVP 不 apply |
| candidates | yaml 為準 |
| 技術 | JSONL；confidence `< 0.6` |

同化：extract 讀 L2 Current，append / revise / open。

---

## 第三輪（2026-07-18）— 已採納 / 仍開放

| 項目 | 狀態 |
|------|------|
| DLQ requeue 主路徑 | **第四輪已補** → DLQ review |
| L1 草稿蒸發（extract 漏 patch） | 仍開放；coverage check 可選 |
| node 不存在 → DLQ | 仍開放；建議寫進 apply |
| 同日多次 dream_run | 仍開放 |
| nodes-graph MVP 註記 | 仍開放 |
| 手改 L2 無 audit | 接受；後期可選 |

---

## 第四輪評審（2026-07-18）

### 總評

**一句話：** DLQ review 把第三輪最大的缺口（「失敗之後怎麼辦」）補齊了；設計已具備**端到端閉環**，可以開工實作 MVP。

本輪最大新增：**batch settlement + adhoc dream + archive**，取代單筆機械重試。這比 `apply --patch-id` 更符合「人+AI 沉澱後再整合」的大腦隱喻。

```
夜間 dream run
  → 失敗進 pending DLQ
  → 跑完仍清 L1（L0/L1.5 保留）

日後 DLQ review
  → settlement report（dream/reviews/）
  → adhoc extract（失敗 → pending 不動；不擋主流程）
  → extract 成功 → L1.5 dlq_review + archive scope
  → disposition apply → apply（新失敗 → 新 DLQ）
```

### 本輪亮點

| 改進 | 評價 |
|------|------|
| `dead-letter-archive/` + 不刪歷史 | 審計鏈完整 |
| adhoc dream **絕對不清 L1** | 與夜間 run 區分清楚 |
| 必須顯式 `dead_letter_ids` scope | 避免誤清全部 pending |
| `dlq_review` 進 L1.5 | audit 與決策分離一致 |
| `disposition: discard` | 明確放棄路徑 |
| activation 連到 DLQ review | 讀者找得到恢復流程 |

### 第三輪問題 → 現狀

| 原問題 | 現狀 |
|--------|------|
| DLQ requeue 略薄 | **已解** — DLQ review 為主路徑 |
| L1 coverage 蒸發 | 仍開放 |
| 幽靈 node → DLQ | 仍開放（INDEX 有，dream.md 未寫死） |
| nodes-graph link MVP | 仍開放 |

---

## 仍存在的問題（按嚴重度）

### 1. adhoc 失敗 vs archive（已定案 — 方案 A）

**僅 adhoc extract 成功產出後才 archive scope。** extract 失敗 → pending 不動；Activation 仍可 `dead_letter_pending`。Adhoc 卡住可接受，不擋日間 Ingest／夜間 `dream run`。

詳 [dream.md](./dream.md#dlq-review已定案)。

~~原問題：無論成敗一律 archive → 可能誤報 ok~~ — 已改。

---

### 2. settlement report → extract 的機械契約略薄

adhoc 輸入是 report，不是 L1。實作需約定：

- [ ] report 必含 `dead_letter_ids`（已有）
- [ ] extract 是否自動帶上 archived DLQ 條的 `event_refs` / 原 patch 內容？
- [ ] `dream_run_id` 命名（如 `adhoc-dlq-2026-07-18`）與冪等

建議在 dream.md 加一小節「adhoc extract 輸入契約」（3–5 行即可）。

---

### 3. apply：node 不存在 → DLQ

仍未寫進 [dream.md](./dream.md) apply 規則。MVP node 人手建，Dream 可能 patch 到未批准 id。

- [ ] 明確：**`node not found` → DLQ**，不建目錄、不靜默 skip

---

### 4. L1 coverage（extract 漏掉 L1 區塊）

清 L1 後，漏 extract 的草稿仍會蒸發（只剩 L0 raw）。第三輪已提，仍有效。

- [ ] 可選：extract 結束 warning「L1 node X 無對應 patch」

---

### 5. 同日多次 `dream_run` 的 day chain

仍開放。若 MVP convention「每晚一次」可先不實作 merge；手動重跑需 `patch_id` 冪等。

---

### 6. `nodes-graph.md` 殘留

flowchart 仍有 `Dream → link`；MVP 不做 graph。建議加「MVP 略過」一行。

---

## 設計品質對照

| 維度 | 第三輪 | 第四輪（現在） |
|------|--------|----------------|
| 失敗恢復閉環 | DLQ 有、路徑薄 | **DLQ review 完整** ✓ |
| 審計鏈 | L1.5 | + archive + reviews + `dlq_review` ✓ |
| Activation 誠實性 | `dead_letter_pending` | **extract 成功才 archive** ✓ |
| MVP 可實作性 | 可開工 | **可開工** |

---

## 建議實作順序

1. Ingest → L0 + L1  
2. `dream run` → extract / apply / DLQ / clear L1  
3. apply 規則（含 node not found → DLQ）  
4. Activation + `dream_status`  
5. candidates upsert  
6. **DLQ review**（可第二個 sprint）：report → adhoc dream → archive  

**第一個 spike：** 1 node、2–3 input、一輪 night run + **故意製造 1 筆 DLQ**，驗證 pending / `dead_letter_pending` / L1.5 可追溯。

---

## 與 INDEX「仍開放」對照

| INDEX 仍開放 | 本評審 |
|--------------|--------|
| apply node 不存在 → DLQ | §3 |
| extract L1 coverage | §4 |
| nodes-graph MVP 註記 | §6 |
| 同日多次 dream_run | §5 |
| week/month、graph、前瞻 | 後期 |

**建議新增至 INDEX 仍開放：**

- [x] adhoc 失敗時 pending archive 語意（§1 → 已定：extract 成功才 archive）
- [ ] adhoc extract 輸入契約（§2）

---

## 總評

| 項目 | 結論 |
|------|------|
| 方向 | ✓ |
| 執行契約 | ✓ 足夠寫 MVP |
| 本輪最大改進 | DLQ review 閉環 |
| 開工前建議 | §1 已鎖；§2 輸入契約可邊做邊補 |
| **建議動作** | **開工實作** |
