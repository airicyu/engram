---
name: engram-ask
description: 用 Engram 的記憶鏈（day／week／month／year）加上尚未沉澱的 pending.jsonl 回答「我記得什麼」。問題點名某個節點時才讀該主檔。在使用者查問、提問、ask、回憶時使用。不要讀 archived.jsonl。不要改檔。
---

# 查問問題

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)

記憶庫：`ENGRAM_STORE_DIR`（環境變數或倉庫根 `.env`；預設 `./demo-engram-data`）。

## 讀哪些

1. **`memories/chain/`** — 日／週／月／年。先近期 day，不夠再 week／month／year。週檔 frontmatter 有 `open: true` 時，回答要說明這是本週至今的短稿，不是已收成的週記。
2. **`memories/pool/pending.jsonl`** — 尚未沉澱的事件。
3. **`memories/future-sight/upcoming.md`** 與 **`longTerm.md`**。
4. **被點名的 node** — 問題裡有 wikilink、id、別名或顯示名時，只比對各檔的 id、frontmatter `aliases`、第一個 H1。唯一命中才讀該主檔全文，並納入回答與來源。多於一個命中：只列 id 並詢問，不讀正文。零命中：只依前三處回答，並說明沒有對上的節點。

## 步驟

1. 讀 `{store}/workspace.yaml`（語言）。Vault＝`{store}/memories/`。
2. 依上一節找內容並回答。不知道就說不知道。

## 禁止

- 不要寫任何記憶檔
- 不要打開 `archived.jsonl`、`jobs/`、`memories/clarify/`，也不要讀未命中的 node 正文
- 不要因為 pending 空就改去掃 archived

## 回覆

繁體中文書面語（若 `memory_language` 為 `en` 則英文）。先答問題，再列來源。
