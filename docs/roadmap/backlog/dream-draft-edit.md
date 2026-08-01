# Backlog — Dream draft 自由句編輯（2b）

← [backlog INDEX](./INDEX.md) · 相關已排程：[0.19.0](../0.19.0/INDEX.md)（只做結構化 category 2a）

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
