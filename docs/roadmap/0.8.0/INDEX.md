# 0.8.0 — 進行中的週記，以及日記空洞

← [GUIDELINES](../GUIDELINES.md) · 上游：[0.7.0](../0.7.0/INDEX.md)（`shipped`）· [changelog](../../../changelog.md) · [version](../../../version.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

**狀態：** `shipped`（2026-11-17）

> **產品句：** 當週在鏈上有一份與正式週記同路徑的短稿，標成進行中；該週結束後的下一次 distill 收成正式週記並清掉進行中標記。本批日曆區間裡整日沒有 day 檔的日期，只出現在該次 distill job 的機械清單，不變成釐清題。

> **開工前仍須拍板：無。**

## 已定案

| # | 題 | 定案 |
|---|----|------|
| 1 | 進行中的週 | 本批碰到的日期若落在「現在」所屬、且尚未結束的 ISO 週，distill **必須**寫或整份取代該週檔。路徑與正式週記相同：`memories/chain/weeks/{週一 YYYY-MM}/{YYYY-Www-MMDD}.md`。不另開草稿檔名。 |
| 2 | 進行中標記 | 該檔以 YAML frontmatter `open: true` 為**唯一**機器標記。Frontmatter 之後的第一個標題行仍是 `##` 題材（不是週號、不是「本週至今」當標題）。正文用書面語寫到今天為止的重心，可出現「本週至今」這類時間說法，但不得只用這句話代替 `open`。已結束並收成的週記**不得**留 `open`（沒有 frontmatter，或 frontmatter 不含 `open`）。 |
| 3 | 收成 | 該 ISO 週已結束（當地今天晚於該週星期日）的下一次 distill，若本批碰到該週、或檔上仍有 `open: true` 且下層日檔在本批有寫入：整份取代為正式週記，刪掉 `open`，取捨後留下重心，刪掉「至今」與過程旁白。不是把短稿接在檔尾。 |
| 4 | 使用者點名 | 使用者這次明說要寫「這週」時，仍是**整份取代**同一路徑。週若尚未結束，寫完後 `open: true` 仍在。月、年只有在該時段已結束或使用者這次明說時才寫；進行中的月、年不寫「至今」稿。Program 不解析使用者語句來判斷有沒有點名。 |
| 4b | 月記不讀短稿 | 寫已結束月記時，跳過 frontmatter `open: true` 的週檔；那些日子改讀 day。年記仍優先讀月記，不另讀進行中週稿。 |
| 5 | 不改更高層進行稿 | 進行中的月檔、年檔若已存在，本版 distill 仍不為未結束的月／年改寫，除非使用者這次明說。 |
| 6 | 缺日清單 | Program 在派 distill **之前**記下本批 `pool/pending.jsonl` 裡**可解析** `ts` 的當地日期。無法解析的 `ts` 不進區間。整份 distill job **成功**後，若至少有一個可解析日期，在最小日與最大日（含首尾）之間，列出沒有對應 `memories/chain/days/YYYY-MM/YYYY-MM-DD.md` 的日期，寫入該 job 的 `output.missing_days`（`YYYY-MM-DD` 字串陣列，升序）。`output.text` 仍保留。沒有可解析的池日期時（含池與 clarify 都空而早退，以及池空但 clarify 仍跑完），成功的 job 寫 `missing_days: []`。Job 失敗不寫 `missing_days`。區間外的日子不掃。不讀 clarify 來擴大區間。 |
| 7 | 清單不進 vault | 不在 `memories/` 建缺口帳、不為缺日新建 `clarify/asking/`。補記仍是使用者 capture 事件，下一次 distill 再寫 day。`engram-clarify-generate` 不得把缺日清單當成出題材料。 |
| 8 | Ask | 讀到週檔 frontmatter `open: true` 時，回答須說明這是本週至今的短稿，不是已收成的週記。不把該稿說成定稿。 |
| 9 | 判斷邊界 | 週記散文仍由 `engram-distill` 寫。Program 只做：蒸餾前的日期快照、蒸餾後的缺日比對、以及「碰到進行中週則週檔必須較新且含 `open: true`；已結束週的週檔不得再含 `open: true`」的檔案核對。Program 不判斷某日重不重要、不補寫日記正文。 |

## 非目標

- 用釐清題問「某日有沒有值得記的事」
- 進行中就寫月記或年記
- 把七篇日文串成週記（收成仍要取捨）
- Server 判斷某天重不重要，或替缺日生成 day 檔
- 在 `memories/` 另開缺口帳本
- 第二份週記檔名（例如 `*.draft.md`）

## 驗收

- [x] `engram-distill` 寫明：未結束的當週要整份寫同路徑短稿且 `open: true`；週結束後收成並清掉 `open`；月／年進行中仍不寫
- [x] `engram-ask` 寫明：`open: true` 的週檔要說是本週至今，不當定稿
- [x] `engram-clarify-generate` 寫明：缺日清單不是出題來源
- [x] `docs/data-spec.md` 寫明週檔可有 `open: true`，以及進行中週與收成規則
- [x] `docs/api.md` 寫明 distill job 的 `output.missing_days`
- [x] `AGENTS.md` 升層閘門改為：進行中的週可寫短稿；進行中的月／年仍不寫
- [x] 單元測試（隔離臨時目錄）：進行中週核對、已結束週不得留 `open`、缺日只含本批首尾之間且不產生 clarify 檔
- [x] `bun test` 通過
- [x] 測試與 demo 無真人記憶正文

## Track

| 序 | 內容 |
|----|------|
| 1 | 契約：`docs/data-spec.md`、`docs/api.md`、`AGENTS.md`、三份 skill。Distill 檔案核對擴充（`open: true`／收成後不得留 `open`）與單元測試 |
| 2 | 蒸餾前日期快照與 `output.missing_days`；clarify-generate 不讀該清單。單元測試 |
| 3 | `engram-ask` 對 `open: true` 的說法（skill 契約測試） |

## 錨點檔案

`.agents/skills/engram-distill/SKILL.md`、`.agents/skills/engram-ask/SKILL.md`、`.agents/skills/engram-clarify-generate/SKILL.md`、`server/worker/distill-gate.ts`、`docs/data-spec.md`、`docs/api.md`、`AGENTS.md`

## 文件地圖

| 檔 | 職責 |
|----|------|
| INDEX.md | 本版 WHAT |
| docs/how.md | 標記、收成、缺日清單怎麼落在 skill 與 job |
| docs/reasoning.md | 為什麼只開週、為什麼清單不進 vault |
| HANDOFF.md | 開工順序與禁區 |
