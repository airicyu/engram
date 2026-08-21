# 0.41.0 HANDOFF

← [INDEX](./INDEX.md)（衝突時 **INDEX 勝**）· [locking-and-snapshots](./docs/locking-and-snapshots.md) · [reasoning](./docs/reasoning.md) · [design-review](./docs/design-review.md)（已併入；勿當第二份契約）

狀態改 **in progress** 再實作。不要發明 INDEX 沒寫的語意。**Do not commit unless the user asks.** 對使用者用繁體中文書面語（`AGENTS.md`）。

## 產品摘要

入夢單場背景跑；extract 中人可記帳／上傳／寫釐清。本場只消化開跑時凍結的 pool 與 pending（`input.json`）。`dream_locked` 只擋第二場夢與進行中的審核。

## 讀檔順序

1. `AGENTS.md`
2. 本 HANDOFF
3. `docs/roadmap/0.41.0/INDEX.md`（已定案 A–E、非目標、Track、驗收）
4. `docs/locking-and-snapshots.md`
5. 需要時 `reasoning.md`；與 INDEX 衝突以 INDEX 為準

INDEX **沉默才提問**，否則跟已定案。

## Track 順序（做完一軌窄測再下一軌）

| 序 | Track |
|----|--------|
| 1 | **A** 快照＋pipeline＋寫入鎖＋git |
| 2 | **B** HTTP 409、agent 可讀、api／skills／self-test |
| 3 | **C** UI／i18n／Sidebar |
| 4 | `cd server && bun run test:phases`（phases 若要求 `ENGRAM_DREAM_AUTO_APPROVE=0` 維持） |

## 禁區

兩場夢；Ask 改為不讀 live pool；clarify id 塞進 `scope[]`；記憶鏈 UI；DELETE tmp 的 lock；多進程；store migrate／抬 boot。

## 完成

勾 INDEX 驗收。建議另開 agent 寫 `docs/implementation-review.md`。

## Starter prompt

```text
你是實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.41.0/HANDOFF.md → INDEX.md（已定案＋非目標＋Track＋驗收）→ docs/locking-and-snapshots.md。
依 Track A→B→C 實作 0.41.0。把 INDEX 狀態改為 in progress。
INDEX 已寫的不要再問；沉默才提問。不要做非目標。
不要 commit，除非我明確要求。
對使用者用繁體中文書面語。
```
