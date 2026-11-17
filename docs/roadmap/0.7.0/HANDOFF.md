# 0.7.0 HANDOFF

讀檔順序：本檔 → [INDEX.md](./INDEX.md) → [docs/how.md](./docs/how.md) → [docs/reasoning.md](./docs/reasoning.md)。設計審查已通過（無未關 HIGH）。

**產品：** pi-agent skill `engram-node` 在使用者指名時合併或刪除 node；腳本改寫 wikilink；distill 沿用 `aliases` 並刪既有空殼；Ask 唯一命中才讀該主檔。

**Track 順序：** 1 腳本＋ node skill＋ data-spec → 2 distill skill → 3 ask skill＋ `AGENTS.md`。然後 `bun test`。

**禁區：** 不自動聚類、不加 UI／HTTP 合併、不寫 `merged_into`、不改 `clarify/` 與 `archived.jsonl`、不維護 `activity_score`、不把真人記憶寫進測試。本批 `node-create` 骨架同一輪不刪。

**錨點：** `.agents/skills/engram-node/`、distill／ask SKILL、`docs/data-spec.md`、`AGENTS.md`。

## Paste-ready

```text
實作 Engram 0.7.0。只認 docs/roadmap/0.7.0/INDEX.md 與 docs/how.md。
Track 1：engram-node skill 與 rewrite-links 腳本（merge 只改路徑；delete 改純文字並刪目錄；pending.jsonl 仍合法 JSON）。
Track 2：distill 沿用 aliases／H1；空殼呼叫 delete 腳本；本批 node-create 不刪。
Track 3：ask 唯一命中讀全文，多名只列 id，零命中明說。更新 data-spec 與 AGENTS.md。
bun test。不要 commit。不要碰真人 store。
```
