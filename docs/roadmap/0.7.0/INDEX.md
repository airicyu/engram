# 0.7.0 — 節點別名、合併／刪除、Ask 點名讀節點

← [GUIDELINES](../GUIDELINES.md) · 上游：[0.6.1](../0.6.1/INDEX.md)（`shipped`）· [changelog](../../../changelog.md) · [version](../../../version.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

**狀態：** `shipped`（2026-11-17）

> **產品句：** 使用者在倉庫根目錄用 pi-agent 呼叫獨立 skill，把兩個節點併成一個或刪掉一個，並自動改寫 vault 裡的 wikilink；別名寫在主檔上，之後 distill 不再為同一個別名開第二份 node；Ask 只在問題點名時讀那一份主檔。

> **開工前仍須拍板：無。**

## 已定案

| # | 題 | 定案 |
|---|----|------|
| 1 | 入口 | 新 skill `engram-node`。只在倉庫根目錄由 pi-agent 呼叫。無 UI 合併流程、無新 HTTP API。Server 不做名字相似度合併。 |
| 2 | 別名 | 主檔 frontmatter `aliases:`（字串清單：其他 id 或顯示名）。不另開小檔，不寫 `merged_into`。 |
| 3 | 合併 | 使用者指名從檔 id 與主檔 id。Skill 把從檔 Identity、Relation、Standing facts、Current situation 收進主檔（不重複堆砌同一句），`aliases` 含從檔 id 與從檔顯示名。接著呼叫機械腳本只改寫連結（路徑改為主檔，`\|顯示名` 原字保留）。Skill 確認四節已寫入後自行刪除從檔目錄。腳本的 merge 模式不刪檔。 |
| 4 | 刪除 | 使用者指名 id。腳本 `delete` 把該 wikilink 換成純文字顯示名（無 `\|` 的 `[[nodes/{id}/{id}]]` 換成 id 文字），然後刪除該 node 目錄。 |
| 5 | 掃描範圍 | `memories/chain/**/*.md`、`memories/nodes/**/*.md`、`memories/future-sight/*.md`、`memories/pool/pending.jsonl`。不改 `clarify/`，不改寫 `archived.jsonl`。`pending.jsonl` 只替換連結子字串，該行仍須是合法 JSON，其餘欄位不動。帶 `\|顯示名` 與不帶 pipe 的兩種 wikilink 都改。 |
| 6 | Distill | 寫 chain 或新建／更新 node 前，讀已存在主檔的 `aliases` 與 H1。已知 id、別名或 H1 顯示名指向該主檔，不開第二份；本次使用的顯示名若尚未在 `aliases` 則寫入。空殼刪除只適用「本批開始前就已存在」的檔：Standing facts 與 Current situation 皆空或只有佔位句，本批又出現該 id，仍寫不出可引用事實 → 呼叫與刪除相同的腳本（改純文字並刪目錄）。本批 `node-create` 強制建立的骨架不得在同一輪刪掉。判定寫在 distill skill，不寫成 server 分類器。 |
| 7 | Ask | 問題出現 wikilink、id、別名或顯示名時，只比對各 node 的 id、frontmatter `aliases`、以及第一個 H1。唯一命中才讀該主檔全文。多於一個主檔命中：列出這些 id，詢問指哪一個，不併讀正文。同時仍讀 `future-sight/upcoming.md` 與 `longTerm.md`（0.3.3 已有）。零命中：只依 chain、pending、future-sight 回答，並說明沒有對上的節點。不讀 `archived.jsonl`，不讀 `clarify/`。 |
| 8 | 純 CLI 寫入 | 本 skill 直寫 vault **不**觸發 store git commit（與現有 pi-agent 直跑 skill 相同）。 |

## 非目標

- 從日記聚類「這兩個 node 是同一人」
- UI 合併／刪除按鈕，或 `POST` 合併
- `merged_into` 短指針
- Ask 讀 `archived.jsonl` 或 `clarify/`
- 改寫 `archived.jsonl` 裡的舊連結
- Distill 維護 `activity_score`
- 把真人記憶正文寫進測試或 demo

## 驗收

- [x] `engram-node` 寫明：只在使用者指名時合併或刪除；合併收四節、寫 `aliases`、改寫連結、刪從檔
- [x] 機械改寫腳本：合併只換路徑、顯示名不變；刪除改成純文字；不碰 `clarify/` 與 `archived.jsonl`；有單元測試（隔離臨時目錄）
- [x] `engram-distill` 寫明沿用 `aliases`，以及空殼再碰到仍無事實則刪檔
- [x] `engram-ask` 寫明：唯一命中才讀全文；多名命中只列 id 並詢問；零命中要明說；不掃未命中的 node 正文
- [x] `docs/data-spec.md` 記載 `aliases` 與上述掃描邊界
- [x] `AGENTS.md` 的 ask 列改為點名才讀該主檔，不再寫「不要讀 nodes」
- [x] `bun test` 通過
- [x] 測試與 demo 無真人記憶正文

## Track

| 序 | 內容 |
|----|------|
| 1 | `engram-node` skill ＋ wikilink 改寫腳本與單元測試；`docs/data-spec.md` 的 `aliases` |
| 2 | `engram-distill`：別名指向主檔、空殼刪除（skill 契約測試） |
| 3 | `engram-ask`：點名讀主檔與對不上時的說法（skill 契約測試） |

## 錨點檔案

`.agents/skills/engram-node/SKILL.md`、`.agents/skills/engram-node/scripts/`（改寫腳本）、`.agents/skills/engram-distill/SKILL.md`、`.agents/skills/engram-ask/SKILL.md`、`docs/data-spec.md`、`AGENTS.md`

## 文件地圖

| 檔 | 職責 |
|----|------|
| INDEX.md | 本版 WHAT |
| docs/how.md | skill 與腳本怎麼分工 |
| docs/reasoning.md | 為什麼改寫連結、為什麼不留指針、為什麼不進 UI |
