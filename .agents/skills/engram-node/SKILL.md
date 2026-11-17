---
name: engram-node
description: 在使用者指名時，合併兩個 Engram 節點或刪除一個節點，並改寫 vault 內的 wikilink。不要自行判斷兩個 node 是不是同一人。不要改 chain 文體。
---

# 合併或刪除節點

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)。版本做法：[0.7.0](../../../docs/roadmap/0.7.0/INDEX.md)。

記憶庫：`ENGRAM_STORE_DIR`（環境變數或倉庫根 `.env`；預設 `./demo-engram-data`）。以下稱 `{store}`。

只在使用者**已經說出**從檔 id 與主檔 id，或要刪的 id 時動手。不要從日記聚類「這兩個是同一人」。不要改 `memories/clarify/`。不要改寫 `memories/pool/archived.jsonl`。不要維護 `activity_score`。

## 合併

1. 讀 `memories/nodes/{從檔id}/{從檔id}.md` 與主檔。缺一則停止並說明。
2. 把從檔的 Identity、Relation、Standing facts、Current situation 收進主檔。同一句不要重複堆。主檔 frontmatter `aliases:` 必須包含從檔 id；從檔的 H1 顯示名若不在清單內也寫入。
3. 呼叫改寫腳本（只換路徑，`|顯示名` 原字保留；不刪檔）：

```bash
bun run .agents/skills/engram-node/scripts/rewrite-links.ts merge --store "{store}" --from "{從檔id}" --into "{主檔id}"
```

4. 確認主檔已寫入後，刪除 `memories/nodes/{從檔id}/`。腳本的 merge 模式不會刪這個目錄。

## 刪除

使用者指名 id 之後：

```bash
bun run .agents/skills/engram-node/scripts/rewrite-links.ts delete --store "{store}" --id "{id}"
```

有 `|顯示名` 的 wikilink 變成該顯示名純文字；沒有 pipe 的變成 id 文字。腳本接著刪除該 node 目錄。

## 腳本範圍

`memories/chain/**/*.md`、`memories/nodes/**/*.md`、`memories/future-sight/*.md`、`memories/pool/pending.jsonl`。`pending.jsonl` 只替換連結子字串，該行仍是合法 JSON，其餘欄位不動。

回覆列出改過的主檔、刪掉的 id、腳本印出的檔案。直跑本 skill **不**做 store git commit。
