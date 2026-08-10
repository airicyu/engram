# Backlog — AI 反思與認知補問（reflective prompts）

← [backlog INDEX](./INDEX.md) · **已排程：** [0.30.0](../0.30.0/INDEX.md)（planned）

> **產品真相以 [0.30.0 INDEX](../0.30.0/INDEX.md) 與 [0.30.0 reasoning](../0.30.0/docs/reasoning.md) 為準。**  
> 本檔保留早期構想史料；下列「待 brainstorm」多數已在 0.30 收斂為已定案（仍有「開工前仍須拍板」）。

## 題目

目前記憶主循環是 **人寫 activity → 入夢 consolidate → L2 nodes／chain**。資訊流向單向：系統被動消化使用者說過的事。

構想：AI 也可 **反思** 既有 nodes／夢內容，向使用者 **補問**；人亦可 **順帶補充**；經釐清 queue 與入夢蒸餾，**經 approve** 補完 node 認知。

一句話：**不只等人說，系統也能說「我想搞懂這件事」。**

## 0.30 收斂摘要（勿以本表覆寫 INDEX）

| 面向 | 0.30 方向 |
|------|-----------|
| 場景 | 第五 tab **釐清**；區內 **補問** cards＋**順帶補充** |
| Store | `memories/clarify/{asking,pending,history}/` |
| 閉環 | 非 activity；distill → draft **nodes only**；approve 才 live＋pending→history |
| 入夢 | 末段 job：`clarify_distill` 然後 `clarify_generate`；rollup-only 也跑 |
| 上限 | asking ≤10；每輪新 3–5；prune＝真刪 |

## 史料：早期待決（多數已解）

| 面向 | 早期選項 | 0.30 |
|------|----------|------|
| 產物形狀 | 佇列 vs node metadata vs STM | **clarify 三 queue** |
| Agent | 獨立 job vs extract 副產物 | **兩獨立 job**（末段） |
| 閉環 | activities + source vs 專用 | **專用 clarify；經人審** |
| 與 Seek | 易混 | **獨立場景對偶** |

## 非目標（構想階段；仍有效）

- 系統未經使用者確認（approve）自動改 live L2
- 取代使用者自發 capture
- 通用 chatbot 式嘮叨、無依據的追問

## 錨點

- **實作／定案：** `docs/roadmap/0.30.0/`
- 記憶循環：`AGENTS.md`
- Seek：`docs/api-docs/api.md`
- Node：`memories/nodes/{id}/{id}.md`（0.28+）
