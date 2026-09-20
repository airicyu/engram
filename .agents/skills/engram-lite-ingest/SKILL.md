---
name: engram-lite-ingest
description: 把使用者說的事梳理成一筆或多筆事件，append 到 Engram Lite 的暫存 pool（memories/pool/pending.jsonl）。在使用者要記下、capture、ingest、輸入事件時使用。不要寫日記或 nodes。
---

# 輸入事件

UI／`POST /events` 是**機械寫入**（一筆、現在時間、不拆、不寫 note）。本 skill 仍給 **pi-agent**：可拆成多筆、可寫 `note`。不要改 chain／nodes。

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)

記憶庫：環境變數 `ENGRAM_LITE_STORE_DIR`，或倉庫根 `.env` 同名鍵（相對路徑以 engram-lite 為準）。預設 `./demo-engram-lite-data`。

## 步驟

1. 讀記憶庫內 `workspace.yaml`（時區、語言）。沒有則當 `Asia/Hong_Kong`、`zh-Hant`。
2. 讀現有 `memories/pool/pending.jsonl`（可空），避免 `id` 碰撞。
3. 把使用者這次輸入梳理成 1～N 筆獨立事件：
   - 一件事一筆；明顯多件事才拆
   - `raw` 保留原句（拆筆時各筆 `raw` 用對應片段，並可在 `note` 交代來自一次輸入）
   - `ts`：有明確時間用該時間；否則用現在（該 timezone 的 RFC3339）
   - `id`：`evt_YYYYMMDD_` + 6 位小寫字母數字
   - `note`：一句話梳理（主題、誰、結果）；語言跟 `memory_language`
4. **append** 到記憶庫 `memories/pool/pending.jsonl`（每筆一行 JSON）。目錄不存在就建。
5. **不要**改 `memories/chain/`、`memories/nodes/`、`archived.jsonl`。**不要**新建 `memories/clarify/` 題目（生題由 program 在 distill 之後另開 `engram-lite-clarify-generate`；本 skill 也不寫 aside）。
6. 若輸入含已落地附圖，embed 與可選 `attachments[]` 須符合 data-spec 對稱規則；不要發明 `_attachments` path。

## 回覆使用者

列出寫入的 `id` 與 `note`。短。
