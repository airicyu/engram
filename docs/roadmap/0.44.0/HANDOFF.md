# 0.44.0 HANDOFF

← [INDEX](./INDEX.md)（衝突時 **INDEX 勝**）· [how](./docs/how.md) · [reasoning](./docs/reasoning.md)

狀態改 **in progress** 再實作。不要發明 INDEX 沒寫的語意。**Do not commit unless the user asks.** 對使用者用繁體中文書面語（`AGENTS.md`）。

## 產品摘要

事件頁第三 tab「近期入夢報告」：只讀尚未 TTL 刪除的 **committed** dream report。新 `GET /dreams/reports` 與 `GET /dreams/reports/{id}`。另修近期輸入區釐清已答 **多行被裁成第一行**。沉澱 tab 與 cleanup **不變**。

## 讀檔順序

1. `AGENTS.md`
2. 本 HANDOFF
3. `docs/roadmap/0.44.0/INDEX.md`
4. `docs/how.md`

INDEX **沉默才提問**，否則跟已定案。

## Track 順序

| 序 | Track |
|----|--------|
| 1 | **A** list／get API＋測試＋api.md |
| 2 | **B** hash `dream-reports`＋事件第三 tab 殼 |
| 3 | **C** 上下主從 UI、i18n |
| 4 | **D** 區（2）多行答可見＋出貨文件 |
| 5 | `cd server && bun run test:phases` |

## 禁區

改 auto-approve／TTL／pending 契約；列出 discarded；本 tab 放 approve／discard；store migrate；抬 boot；為本 tab 改事件欄全寬或左右兩欄。

## 完成

勾 INDEX 驗收。建議另開 agent 寫 `docs/implementation-review.md`。本版無 backlog 獨立 `.md` 可刪。

## Starter prompt

```text
你是實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.44.0/HANDOFF.md → INDEX.md（已定案＋非目標＋Track＋驗收）→ docs/how.md。
依 Track A→B→C→D 實作 0.44.0。把 INDEX 狀態改為 in progress。
INDEX 已寫的不要再問；沉默才提問。不要做非目標。
不要 commit，除非我明確要求。
對使用者用繁體中文書面語。
```
