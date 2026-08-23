# 0.43.0 HANDOFF

← [INDEX](./INDEX.md)（衝突時 **INDEX 勝**）· [how](./docs/how.md) · [reasoning](./docs/reasoning.md)

狀態改 **in progress** 再實作。不要發明 INDEX 沒寫的語意。**Do not commit unless the user asks.** 對使用者用繁體中文書面語（`AGENTS.md`）。

## 產品摘要

（1）Dream cleanup 刪 report 時連 yaml／input.json 一起刪；pending 與 `l1_clear_pending` 不刪。（2）終態 Ask 寫 `dreams/ask-history`；`GET /memories/ask/recent`；尋問列表點選回看，不重跑。

## 讀檔順序

1. `AGENTS.md`
2. 本 HANDOFF
3. `docs/roadmap/0.43.0/INDEX.md`
4. `docs/how.md`

INDEX **沉默才提問**，否則跟已定案。

## Track 順序

| 序 | Track |
|----|--------|
| 1 | **A** cleanup 同步刪 yaml／input＋測試 |
| 2 | **B** ask-history 檔、GET recent、sweep、api.md |
| 3 | **C** SeekScene UI、workbench、phases、出貨文件 |
| 4 | `cd server && bun run test:phases` |

## 禁區

migrate／抬 boot；改 extract／approve；Ask `include_later`；UI 顯示 sources；hash 深鏈；把問答寫進 `memories/**`。

## 完成

勾 INDEX 驗收。出貨時刪 `backlog/dream-runs-cleanup.md`、`backlog/ask-recent-history.md` 並改 backlog INDEX（GUIDELINES：已出貨不佔 backlog）。建議另開 agent 寫 `docs/implementation-review.md`。

## Starter prompt

```text
你是實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.43.0/HANDOFF.md → INDEX.md（已定案＋非目標＋Track＋驗收）→ docs/how.md。
依 Track A→B→C 實作 0.43.0。把 INDEX 狀態改為 in progress。
INDEX 已寫的不要再問；沉默才提問。不要做非目標。
不要 commit，除非我明確要求。
對使用者用繁體中文書面語。
```
