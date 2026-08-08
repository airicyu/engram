# Backlog — Dream draft 自由句編輯（2b）

← [backlog INDEX](./INDEX.md) · **已出貨：** [0.27.0](../0.27.0/INDEX.md)（`POST /dreams/amend` + Revise UI）

> 本檔保留為構想史料。產品真相以 **0.27.0 INDEX** 與 `docs/api-docs/api.md` 為準；backlog INDEX 已不再列本條。

## 題目

Pending review 時，使用者用自然语言指示，讓 agent **在同一 `dream_run_id` draft 上**做最小修改（例如改某日 summary、某 node `what.md`），而不必 discard 或整輪 retry。

## 為何不進 0.19

0.19 以 node 活躍分為主；category 錯判已用 **2a 結構化 API** 覆蓋。自由句改檔需路徑白名單、格式校验、失敗不毀 pending——範圍獨立，適合另版。

## 粗範圍（將來定案時寫進 version INDEX）

- `POST /dreams/…/edit`（名再定），body `instruction` 必填
- Agent 僅改 draft 白名單路徑；server 校验後寫回；失敗保留可審狀態
- 與 retry（重抽）語意分開
- 仍可改 involvements，但能走 2a 的不強制走 2b

## 非目標（構想階段）

- 無 pending 時改 live 記憶
- 取代 approve 人審

## UX 約束（2026-08-08 討論）

Consolidate pending 現況操作已偏多：report 閱讀、involvements 下拉（2a）、Approve／Discard、Retry＋reason textarea、Refresh／Cancel／進度 log。**2b 不可再平行加一組「自由句＋送出」**，否則語意混在一起。

### 目標版面（產品草圖）

1. **Approve｜Discard** — 主列唯二主鍵  
2. **Revise** — 可展開；內有 **revise context** textarea  
   - 做法二選一：**(1) re-dream**（＝現行 retry／整輪重抽）｜**(2) amend-dream**（＝2b／同稿小修）  
3. **Node score adjust** — 現行 2a involvements（放在 revise **下方**）

閱讀區（report／變更摘要）在操作區之上或旁；調整進行中主列 disable，進度複用既有 dream job log。

### 心智模型

| 意圖 | UI | 對 draft |
|------|-----|----------|
| 這輪大致 OK | Approve | 部署 |
| 這輪不要 | Discard | 丟棄 |
| 抽錯方向，要重來 | Revise → **re-dream** | 新 `run_id` |
| 正文小錯，同稿修 | Revise → **amend-dream** | 同 `run_id` |
| 只是 category 錯 | Node score adjust（2a） | 只改 artifact |

活躍分 category **不**逼進自由句。

### Report 閱讀

**已定案（2026-08-08）：方案 A** — `MdBlock` 以 Markdown→HTML 渲染既有字串（`react-markdown`）；**不**改 pending API、**不**拆 JSON sections。結構化分卡（原 B／C）延後。

Involvements 已是 structured，繼續獨立於 report 正文。

排進 version（amend-dream）前須把版面＋Revise 兩模式寫進 INDEX「已定案」；API 名可後定，**產品動詞：re-dream ≠ amend-dream**。
