# 0.45.0 HANDOFF

← [INDEX](./INDEX.md)（衝突時 **INDEX 勝**）· [how](./docs/how.md) · [reasoning](./docs/reasoning.md) · [design-review](./docs/design-review.md)

狀態改 **in progress** 再實作。不要發明 INDEX 沒寫的語意。**Do not commit unless the user asks.** 對使用者用繁體中文書面語（`AGENTS.md`）。

## 產品摘要

入夢加速、不降日／週寫作品質：機械 rollup plan（不 spawn planner；skip reason 不得被 stub 污染）；clarify generate 僅在本場寫了 week 且 asking 未滿 10 時開一次（門檻在 mkdtemp 前）；day extract 凍結 node 改 Identity 名片 + Read；mock 改既有 node 讀主檔全文；Claude generate 不 `--add-dir` 整座 store。

## 讀檔順序

1. `AGENTS.md`
2. 本 HANDOFF
3. `docs/roadmap/0.45.0/INDEX.md`
4. `docs/how.md`

INDEX **沉默才提問**，否則跟已定案。

## Track 順序

| 序 | Track |
|----|--------|
| 1 | **A** 機械 plan；刪 `plan`／`rollup-plan.md`；skip reason |
| 2 | **B** generate 三道門檻（mkdtemp 前）+ `reports` 傳 week |
| 3 | **C** 名片 + excerpt + `dream-files.md` + **mock 讀主檔** |
| 4 | **D** `addStoreDir` + domain-language + phases |
| 5 | `cd server && bun run test:phases` |

## 禁區

模型分流；writer 散文大改；日塊或多 writer 並行；用「新 node」當 generate 開關；改 GET nodes `understanding`；stub `reason: "mechanical"`；store migrate；UI／新 HTTP；對 distill／extract 關 store `--add-dir`。

## 完成

勾 INDEX 驗收。建議另開 agent 寫 `docs/implementation-review.md`。出貨時才改 `version.md`／`changelog.md`。無 backlog 獨立 `.md` 可刪。

## Starter prompt

```text
你是實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.45.0/HANDOFF.md → INDEX.md（已定案＋非目標＋Track＋驗收）→ docs/how.md。
依 Track A→B→C→D 實作 0.45.0。把 INDEX 狀態改為 in progress。
INDEX 已寫的不要再問；沉默才提問。不要做非目標。
不要 commit，除非我明確要求。
對使用者用繁體中文書面語。
```
