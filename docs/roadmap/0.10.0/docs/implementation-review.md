# Implementation review — 0.10.0 Rewrite a node when distill touches it

- 日期：2026-11-17（Asia/Hong_Kong）
- 輪次：**第 1 輪**
- 角色：實作審查（不改程式）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)；[`reasoning.md`](./reasoning.md)；[`../HANDOFF.md`](../HANDOFF.md)
- **總評：** 無未關閉 HIGH。本輪有寫的 node 會整段換掉 Standing facts 與 Current situation，規則在 `engram-distill` 與 `docs/data-spec.md`；server 不改寫 node 散文。`bun test` 退出沙箱後全綠（110 pass／0 fail）。狀態維持 `in progress`，尚未出貨。

## Findings

### HIGH

本輪無。

### MEDIUM

本輪無。

### LOW

| ID | 狀態 | 依據 |
|----|------|------|
| L1 | **非阻擋** | 已定案第 3 條的 bullet 日記尾巴，以及第 6 條（不寫入檔案與本輪事件／已吸收釐清以外的事實、保留仍需要的 wikilink、frontmatter 除 0.7.0 別名外維持）寫在 skill 步驟 6e。`docs/data-spec.md` Nodes 的 distill 段有整段取代、一幅現在、仍成立的 bullet、三個覆蓋來源、另一份日檔不得單獨當證據、Identity／Relation 只在有變時改、沒寫的 node 不動。該段沒有另寫 bullet 不得留「截至某日」尾巴，也沒有複述第 6 條。驗收只要求 data-spec 寫同一套兩段取代規則，故不升 MEDIUM。 |
| L2 | **非阻擋** | `server/test/node-rewrite.test.ts` 的 0.10.0 則只斷言 skill 與 data-spec 含「整段換掉」「一幅現在」「仍成立」等子字串。沒有斷言日記尾巴、另一份日檔、或不發明事實。HOW 寫明不新增程式檢查，驗收是 skill 正文與 data-spec。 |

## 驗收對照

| INDEX 驗收句 | 結果 | 證據 |
|--------------|------|------|
| `engram-distill` 寫明：本輪有寫的 node 整段換掉 Standing facts 與 Current situation；現況是一幅現在；穩定事實是仍成立的 bullet，合併重複、刪掉被覆蓋的主張；Identity／Relation 只在身分或關係有變時改；沒碰到的 node 不動 | 通過 | 步驟 6e：建立或更新的 node 兩段整段換掉，不在舊文下再加「截至某日」。Current situation 收成一幅現在；一次性事件、版本號、菜單可離開，細節留在 day；仍描述現在的句子留著，除非被該檔較晚主張、本輪 pool、或本輪吸收的釐清推翻；另一份日檔不得單獨當證據。Standing facts 一事實一 bullet、同一事實合併、只在上述三者推翻時刪、不留日記尾巴、不為變短而刪。Identity／Relation 只在「是誰或是什麼」或關係改變時改，不搬事件散文。沒建立或更新的 node 不為這條另開或存檔；為判斷而讀檔照舊。同段含已定案第 6 條。新建沿用步驟 6 的四段，並落入 6e，不以日期堆疊起稿。空殼仍是步驟 6d：本批開始前已存在、兩段仍空或佔位、仍寫不出事實才刪；本批 `node-create` 骨架同一輪不刪。 |
| `docs/data-spec.md` 寫同一套兩段取代規則 | 通過（L1） | Nodes 的 distill 段與上列取代、覆蓋來源、沒寫不動一致。模板兩段改為「仍成立的穩定事實。一條一個 bullet」與「一幅現在（完整句子），不是多段日期快照」。第 6 條與 bullet 尾巴見 L1。空殼句仍在刪除段。 |
| 沒有 server 程式為這條分類或改寫 node 散文 | 通過 | `server/` 的 TypeScript 沒有依這兩段打分、diff 或改寫。`Standing facts` 只出現在既有 wikilink 測試的 fixture，以及 L2 的正文斷言。無新 skill、無新 HTTP route。 |
| `bun test` 通過 | 通過 | 見下節。 |

非目標抽樣：沒有掃過未寫到的 node 的程式路徑。Ask 的 prompt 仍寫明不要讀 `memories/nodes/`。`activity_score` 仍標成 distill 不維護。chain 文體與升層閘門不在本版 diff 的語意裡。

## 測試結果

指令：倉庫根 `bun test`。未 reset 真人 `ENGRAM_STORE_DIR`。未把真人記憶正文寫進本報告。

- 沙箱：110 則中 5 則失敗，皆在 `server/git/store-git.test.ts`（臨時目錄 `git init` 寫 `.git/hooks/` 出現 `Operation not permitted`）。與 0.10.0 的 skill／data-spec 改寫無關。
- 不受限權限重跑：**110 pass，0 fail**（28 檔，517 expect）。含 `server/test/node-rewrite.test.ts` 的 0.10.0 子字串則。

## 修復追蹤

| ID | 級 | 狀態 | 關閉位置 |
|----|----|------|----------|
| L1 | L | 非阻擋 | data-spec 未複述 bullet 日記尾巴與已定案第 6 條；skill 6e 已寫 |
| L2 | L | 非阻擋 | 測試只鎖子字串，不鎖其餘句子 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 第 1 輪 | 2026-11-17 | 無未關 HIGH。無 MEDIUM。L1、L2 非阻擋。`bun test` 退出沙箱後 110 pass／0 fail。 |
