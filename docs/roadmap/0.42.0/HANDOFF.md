# 0.42.0 HANDOFF

← [INDEX](./INDEX.md)（衝突時 **INDEX 勝**）· [api-and-ui](./docs/api-and-ui.md) · [reasoning](./docs/reasoning.md) · [design-review](./docs/design-review.md)（已併入；勿當第二份契約）

狀態改 **in progress** 再實作。不要發明 INDEX 沒寫的語意。**Do not commit unless the user asks.** 對使用者用繁體中文書面語（`AGENTS.md`）。

## 產品摘要

近期輸入內容分兩區：短期記憶事件，以及 live clarify pending（已答＋aside）。新 `GET /memories/clarify/pending`。不改 distill／approve／郵箱 asking。

## 讀檔順序

1. `AGENTS.md`
2. 本 HANDOFF
3. `docs/roadmap/0.42.0/INDEX.md`（已定案 A–D、非目標、Track、驗收）
4. `docs/api-and-ui.md`
5. 需要時 `reasoning.md`；與 INDEX 衝突以 INDEX 為準

INDEX **沉默才提問**，否則跟已定案。

## Track 順序（做完一軌窄測再下一軌）

| 序 | Track |
|----|--------|
| 1 | **A** GET pending＋api.md |
| 2 | **B** ActivitiesScene 兩區＋i18n |
| 3 | **C** workbench skill／helper、phases、出貨文件 |
| 4 | `cd server && bun run test:phases` |

## 禁區

history GET；改 generate／黑名單；改 0.41 快照；混排時間軸；編輯 pending；store migrate／抬 boot。

## 完成

勾 INDEX 驗收。出貨時刪 `docs/roadmap/backlog/recent-input-clarify-pending.md` 並改 backlog INDEX。建議另開 agent 寫 `docs/implementation-review.md`。

## Starter prompt

```text
你是實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.42.0/HANDOFF.md → INDEX.md（已定案＋非目標＋Track＋驗收）→ docs/api-and-ui.md。
依 Track A→B→C 實作 0.42.0。把 INDEX 狀態改為 in progress。
INDEX 已寫的不要再問；沉默才提問。不要做非目標。
不要 commit，除非我明確要求。
對使用者用繁體中文書面語。
```
