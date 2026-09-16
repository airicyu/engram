---
name: engram-lite-ask
description: 用 Engram Lite 的記憶鏈（day／week／month／year）加上尚未沉澱的 pending.jsonl 回答「我記得什麼」。在使用者查問、提問、ask、回憶時使用。不要讀 archived.jsonl 或 nodes。不要改檔。
---

# 查問問題

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)

記憶庫：`engram-lite.yaml` 的 `store_dir` 或 `ENGRAM_LITE_STORE_DIR`（預設 `./../engram-lite-data`）。

## 只讀這兩處

1. **`chain/`** — 已沉澱的日／週／月／年記（記憶鏈）。先近期 day，不夠再 week／month／year。
2. **`pool/pending.jsonl`** — 還沒沉澱進鏈的事件。

已沉澱的細節應已寫進 chain，**不要**讀 `pool/archived.jsonl`。**不要**讀 `nodes/`（提問不靠節點檔）。

## 步驟

1. 讀 `workspace.yaml`（語言）。
2. 在 `chain/` 與 `pool/pending.jsonl` 用 grep／find／read 找與問題有關的內容。
3. 只根據這些檔回答。不知道就說不知道。
4. 來源只列 chain 路徑或 `pool/pending.jsonl`。

## 禁止

- 不要寫任何記憶檔
- 不要打開 `archived.jsonl`、`nodes/`、`jobs/`
- 不要因為 pending 空就改去掃 archived

## 回覆

繁體中文書面語（若 `memory_language` 為 `en` 則英文）。先答問題，再列來源。
