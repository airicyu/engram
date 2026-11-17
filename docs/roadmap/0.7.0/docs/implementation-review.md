# Implementation review — 0.7.0 節點別名、合併／刪除、Ask 點名讀節點

- 日期：2026-11-17（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**（初審同日；ID 不重編）
- 角色：實作審查（不改程式）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)
- **總評：** 無未關閉 HIGH。M1、L1 已在 skill／腳本關閉；L2 標非阻擋合理。`bun test` 退出沙箱後全綠（97 pass／0 fail）。可以出貨。

## Findings

### HIGH

本輪無。

### MEDIUM

| ID | 狀態 | 依據 |
|----|------|------|
| M1 | **關閉**（第 2 輪核實） | Ask「步驟」第 3–5 點已納入唯一命中主檔的讀取、回答與來源；多名只列 id；零命中明說。第 2 輪重讀 `.agents/skills/engram-ask/SKILL.md`：第 3 點寫明唯一命中則讀全文並納入回答，第 4 點把該主檔列入回答依據，第 5 點來源可列該 node 路徑。與 INDEX #7、`how.md` Ask 節一致。 |

### LOW

| ID | 狀態 | 依據 |
|----|------|------|
| L1 | **關閉**（第 2 輪核實） | `rewrite-links.ts` 對 `future-sight` 傳 `recursive: false`；`listFiles` 在非遞迴時略過路徑含 `/` 的項目，且 `readdir` 本身不遞迴。只掃該層 `*.md`。 |
| L2 | **非阻擋**（第 2 輪仍合理） | `rewritePending` 對替換後的行 `JSON.parse`；拋錯則函式中止，`writeFile` 尚未執行，pending 不落壞行。markdown 迴圈在 pending 之前，delete 的 `rm` 在 pending 之後，故壞行時目錄仍在。同一指令重跑時連結替換冪等，可補完。這是壞 JSON 的錯誤路徑，不擋 INDEX 主路徑與驗收。 |

## 驗收對照

| INDEX 驗收句 | 結果 | 證據 |
|--------------|------|------|
| `engram-node` 寫明：只在使用者指名時合併或刪除；合併收四節、寫 `aliases`、改寫連結、刪從檔 | 通過 | `.agents/skills/engram-node/SKILL.md`：指名才動手；四節收進主檔；`aliases` 含從檔 id 與 H1；呼叫 `rewrite-links.ts merge`；確認後刪從檔目錄。直跑不 commit。 |
| 機械改寫腳本：合併只換路徑、顯示名不變；刪除改成純文字；不碰 `clarify/` 與 `archived.jsonl`；有單元測試（隔離臨時目錄） | 通過 | `rewrite-links.ts` 的 `rewriteLinkText`；掃描不含 clarify／archived。`server/test/node-rewrite.test.ts` 用 `mkdtemp`：merge 保留顯示名且從檔仍在；archived／clarify 原連結仍在；delete 變成「從檔顯示」與 id 文字並刪目錄。 |
| `engram-distill` 寫明沿用 `aliases`，以及空殼再碰到仍無事實則刪檔 | 通過 | distill `SKILL.md` 6c／6d：讀 `aliases` 與第一個 H1、不開第二份、顯示名寫回；既有空殼呼叫同一 `delete`；本批 `node-create` 同一輪不得刪。 |
| `engram-ask` 寫明：唯一命中才讀全文；多名命中只列 id 並詢問；零命中要明說；不掃未命中的 node 正文 | 通過 | ask `SKILL.md`「讀哪些」第 4 點、「步驟」第 3–5 點與「禁止」。第 2 輪確認步驟已重述主檔讀取（M1 關閉）。 |
| `docs/data-spec.md` 記載 `aliases` 與上述掃描邊界 | 通過 | Nodes：`aliases` 字串清單；掃描 chain、其他 node、future-sight、`pending.jsonl`；不改 clarify／archived；無 `merged_into`。ask 段與刪除／空殼段同 INDEX #6–#7。 |
| `AGENTS.md` 的 ask 列改為點名才讀該主檔，不再寫「不要讀 nodes」 | 通過 | Skills 表 ask 列：「問題點名時才讀該 node 主檔（不讀 archived／clarify；多名命中不併讀）」。另有 `engram-node` 列。 |
| `bun test` 通過 | 通過 | 見下節。沙箱內 store-git 因 `git init` hooks「Operation not permitted」失敗；退出沙箱重跑全綠。 |
| 測試與 demo 無真人記憶正文 | 通過 | 本版新增測試用隔離目錄與虛構標籤（從檔／主檔／事實甲乙）。未讀、未複製真人 store。 |

非目標抽樣：無新 HTTP 合併、server 無名字相似度合併、無 `merged_into`、distill 仍寫明不維護 `activity_score`（data-spec Nodes）。

## 測試結果

指令：倉庫根 `bun test`。未 reset 真人 `ENGRAM_STORE_DIR`。

- 初審沙箱：97 則中 5 則失敗，皆在 `server/git/store-git.test.ts`（`.git/hooks/` `Operation not permitted`）。與 0.7.0 改寫無關。
- 初審退出沙箱：**97 pass，0 fail**。
- 第 2 輪（2026-11-17）重跑：沙箱同樣 5 則 store-git 失敗（`git init` hooks 不許可）；`required_permissions: all` 重跑 **97 pass，0 fail**（25 檔，457 expect）。含 `server/test/node-rewrite.test.ts` 三則。未 reset 真人 store。

## 修復追蹤

| ID | 級 | 狀態 | 關閉位置 |
|----|----|------|----------|
| M1 | M | 關閉 | ask `SKILL.md` 步驟第 3–5 點 |
| L1 | L | 關閉 | `rewrite-links.ts` future-sight 不遞迴 |
| L2 | L | 非阻擋 | 重跑可補完；不擋出貨 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-11-17 | 無未關 HIGH；`bun test` 退出沙箱後全綠。當時摘要曾寫「M1 仍開」，與同檔 findings 表「M1 關閉」不一致；以表與現碼為準。 |
| 第 2 輪複審 | 2026-11-17 | 核實 M1、L1 已在 skill／腳本關閉；L2 非阻擋仍合理。無未關 HIGH。`bun test` 退出沙箱後 97 pass／0 fail。 |
