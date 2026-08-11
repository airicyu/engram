# 0.30.0 設計審查報告

← [INDEX](../INDEX.md) · [queues-and-pipeline](./queues-and-pipeline.md) · [reasoning](./reasoning.md)

> **日期：** 2026-08-11（初審）· **併入已定案：** 2026-08-11  
> **對照基準：** 本版 `INDEX.md` 已定案／驗收／非目標；HOW＝`docs/queues-and-pipeline.md`；WHY＝`docs/reasoning.md`  
> **結論（初審）：** 主幹清楚；HOW／失敗模式有洞，不可開工。  
> **結論（併入後）：** **D1–D9、F1–F7 建議定案已寫入 INDEX（約 #28–#51）與 queues-and-pipeline**；「開工前仍須拍板」為空。做什麼以 **INDEX／queues-and-pipeline 為準**；本檔留審查史料。

---

## 1. 總評（初審 → 併入後）

| 面向 | 初審 | 併入後 |
|------|------|--------|
| 產品句／單主題 | 對 | 對 |
| HOW／失敗模式 | 不足 | 已鎖 |
| 「開工前仍須拍板」 | 應重開 | **空** |

---

## 2. 建議定案 → 已併入

| ID | 題 | 併入 |
|----|-----|------|
| D1 | 快照→`DreamRunState.clarify_pending_snapshot_ids` | INDEX #29 |
| D2 | 硬失敗＝整夢失敗；phase=`materialize`；白名單剔除 | INDEX #31、#37–#38 |
| D3 | generate＝server 落盤＋commit；禁擴 agent live writable | INDEX #33 |
| D4 | distill 允許 create draft node | INDEX #30 |
| D5 | pending 時 `draft_summary` 必為物件＋`clarify_distilled_node_ids` | INDEX #40 |
| D6 | 16KiB／related_nodes ≤16 | INDEX #50–#51 |
| D7 | rollup-only／無 node → score 或 generate no-op | INDEX #35 |
| D8 | report 段序＋截斷邊界 | INDEX #39 |
| D9 | Track A 窄測／mock／phases | Track A／C 驗收句 |
| F1 | retry 前清本輪來源 asking | INDEX #45–#46 |
| F2 | empty_patches 仍歸檔；deploy 失敗不 move | INDEX #41–#43 |
| F3 | clarify 寫互斥；二度 submit→404 | INDEX #49 |
| F4 | generate 組批／部分回滾 | INDEX #34 |
| F5 | distill／generate writable 硬邊界 | INDEX #33；非目標 |
| F6 | discard／amend 不得刪 asking | INDEX #44、#47 |
| F7 | 接受 amend 後舊快照歸檔 | INDEX #47；reasoning |

---

## 3. 已對齊項（初審即確認，仍成立）

場景 id／Topbar 序／無 badge；三 queue＋ensure、無 migrate；非 activity；empty-read 200；lock 409；pending_review 可寫；管線 distill→generate；不新增 UI DreamJobPhase；不做 list pending／history HTTP。

---

## 4. 後續

- 寫 `HANDOFF.md` → 新 agent 實作
- 實作完成後另寫 `implementation-review.md`
