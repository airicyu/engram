# 0.8.0 HANDOFF

讀檔順序：本檔 → `INDEX.md` → `docs/how.md` → `docs/reasoning.md` → `docs/data-spec.md`（Memory chain）→ `AGENTS.md` 升層閘門 → 三份 skill 與 `server/worker/distill-gate.ts`。

## 產品摘要

當週寫同路徑短稿，frontmatter `open: true`。週結束後下一次碰到該週的 distill 整份收成並清掉 `open`。本批 pending 最早到最晚日期之間缺的 day 檔，只列在 distill job 的 `output.missing_days`。不開釐清題，不寫進行中的月／年。

## Track 順序

1. 契約與 distill 檔案核對（`open` 在進行中必須在、收成後不得在）。
2. 蒸餾前日期快照與 `output.missing_days`；clarify-generate 不讀清單。
3. Ask：看見 `open: true` 要說是本週至今。

每個 Track 結束跑該 Track 測試。全部結束跑倉庫根 `bun test`。

## 禁區

- 不把缺日做成 clarify 題，不在 `memories/` 建缺口帳。
- 不寫進行中月記、年記。
- Program 不寫週記散文、不補 day 正文。
- 不 commit，除非使用者要求。
- 不用真人 `ENGRAM_STORE_DIR` 當測試或範例正文。

## 完成檢查

- INDEX 驗收可勾
- `bun test` 全綠
- 契約與 `AGENTS.md`、三 skill 同步

## Paste-ready

```text
實作 Engram 0.8.0。只認 docs/roadmap/0.8.0/INDEX.md、docs/how.md、docs/reasoning.md、HANDOFF.md。
Track 順序照 HANDOFF。進行中週記與正式週記同路徑，frontmatter open: true；週結束後整份收成並刪掉 open。
缺日只寫 distill job output.missing_days，不出釐清題，不寫 memories 缺口帳。
不要寫進行中的月／年。不要 commit。測試用 bun test。不要讀寫真人記憶庫正文。
```
