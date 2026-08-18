# 0.38.0 — Chain 摘要：分段、取捨、文章化

← [changelog](../../../changelog.md) · 上游：[0.37.0](../0.37.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**  
> **本版只改 chain 敘事怎麼寫**（day summary 與 week／month／year rollup 的 prompt；必要的 mock／soft lint／phases）。**不**改 HTTP、**不**改 UI、**不**改 store 路徑／schema、**無** migrate、**不**批量重寫已批准的舊摘要。

## 產品句

> 人打開記憶鏈時，日文可以碎、但不要焊成一堵牆；週／月／年是有取捨的回顧文章，不是把下層全文再貼一次。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作 agent 開工交接 |
| 1 | **本檔 INDEX** | 範圍、定案、非目標、軌道、驗收 |
| 2 | [docs/chain-prose.md](./docs/chain-prose.md) | 各層海拔、分段／標題、可省略什麼、prompt 必須寫進的句子、好／壞例 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何現行 prompt 會產出打包文、為何不靠字數硬卡、為何不回填舊檔 |

---

## 問題（本版要解決什麼）

現行 day／week／month 摘要（人讀 live chain）常見：

1. **打包：** 不相干的事焊進同一 `##`、同一段（例如體檢＋晚飯＋發版，見虛構例）。
2. **標題併題：** 一個標題列出整天所有線，等於沒有分題。
3. **週／月沒有升層：** 幾乎複述日文（菜單、門牌、每一次版號）；月文像週文合訂本。
4. **過程句漏進正文：** 例如週摘要開頭 `Reading the write context to draft the week summary.`（prompt 已禁，執行仍漏）。

根因在寫作契約，不在檔案格式。`rollup-write-week.md` 等已要求「按生活線分節、不要逐日巡遊」，但同時寫「每節一個短段（必要時兩段）」「熔進流暢散文」「下層已有的 `[[nodes/…]]` 都要保留」——模型會解讀成能寫的都寫進同一段。細節與反例見 [chain-prose](./docs/chain-prose.md)、[reasoning](./docs/reasoning.md)。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 範圍 | 只改 **機器寫入的 chain 敘事契約** 與鎖定它的 mock／soft lint／測試。路徑仍是 `memories/chain/days\|weeks\|months\|years/…/*.summary.md`（day 另有 ledger）。**不**改 GET `/memories/chain*` 欄位。 |
| 2 | 日 vs 高階 | **Day summary**＝當天可讀敘事，**允許零碎**；不同生命線分開 `##`，線內不相干就**分段**，不要熔成一段。**Week／month／year**＝回顧文章，**必須取捨**，禁止下層合訂本。Day **ledger** 維持增量碎片，本版不要求文章化。 |
| 3 | 海拔（強制） | 每升一層丢掉一層細節。週回答「這週重心是什麼」；月回答「這個月的節奏／轉折」；年回答「這年的通過線」。日層可保留具體店名、菜、預約鐘點（若當天確實發生）；週預設丢掉菜單／門牌／每次版號（除非該細節**本身就是**本週故事）；月年以上用判斷句帶過發版節奏與生活線，不逐日點名。完整表見 [chain-prose §海拔](./docs/chain-prose.md)。 |
| 4 | 標題 | `##` 仍為內容衍生、約 2–8 詞、禁止固定 Work／Family 清單（維持 0.11／既有 rollup）。**禁止**把多條無關線併進同一個標題（壞例見 [chain-prose 虛構日文](./docs/chain-prose.md)：「北灣體檢、燈塔晚飯與 Harbor 1.4」）。一天有 ≥2 條有內容的線 → **≥2 個** `##`。 |
| 5 | 段落 | **推翻**現行「每節一個短段（必要時兩段）」為預設。新預設：材料碎就多段；只有同一條時間弧才寫成連續段落。禁止為了「看起來融合」而把無關節拍用分號接成一段。 |
| 6 | 文章化 | 完整句子、有時間錨、讀起來像人寫的短文／多則短記；**不是**把專名、版號、路徑用逗號串成清單。**不是**強迫日層寫成有起承轉合的短篇小說。 |
| 7 | 取捨合法 | 週／月／年 **可以（且應該）省略**下層已有、但不定義該時段的節拍。省略不是資料遺失：日層（與 ledger）仍在。禁止「為了完整而複述每一天」。 |
| 8 | Wikilink（相對 0.31 收窄密度、不廢互指） | 提及寫入當下已存在（live 或本輪新建）的 L2 node → 該 **`##` 節內第一次提及必須 P1** `[[nodes/{id}/{id}\|{id}]]`。同節後文可用口語名，**不必**每次掛 link。路人仍不造假 id。0.31 **非回填**維持。 |
| 9 | 下層 link「保留」 | **推翻** rollup「`lower[]` 裡已有的 `[[nodes/…]]` 都要保留」。改為：整段節拍若被省略，其 link 一併省略；若該 node 仍出現在本層正文，則遵守 #8。禁止為了保留 link 而把已決定丢掉的細節抄上來。 |
| 10 | 過程旁白 | 維持「輸出檔第一行必須是 `##`、禁止過程敘事」。本版 **soft lint 必做**：draft `*.summary.md` 若出現過程句（至少英／中：「Reading the write context」「Writing the summary」「已寫入」）→ Structure notes 警告；**不**擋 approve、**不**讓 dream job 失敗。 |
| 11 | Prompt 檔 | 必須改：`server/prompts/extract.md`（`chain.summary` 欄說明）、`server/prompts/dream-files.md`（day summary 寫法＋wikilink 密度）、`server/prompts/rollup-write-week.md`／`month`／`year`、`server/prompts/amend-dream.md`（若改 chain 正文則同樣海拔／分段）。`rollup-plan.md` **不必**為文風改（仍只決定 init／revise 哪些 id）。句子級義務見 [chain-prose §Prompt](./docs/chain-prose.md)。 |
| 12 | Mock | `fuseMockNarrative`（及 day summary mock 若有）須符合：以 `##` 開頭、**不是**把 `lower[]` 全文單段拼接、週／月至少展示「分節＋節內可多段」、含至少一處 P1（維持 0.31 phases）。Mock 仍須確定性，可供 `test:phases` 鎖定。 |
| 13 | 舊 live 摘要 | **不做** migrate、**不做**全庫重寫 job。新契約只約束**本版之後**的 extract／rollup／amend 產出。已關閉週／月若日後因 backfill 被 **revise**，writer 應整篇用新契約重寫（這是既有 revise＝完整替換 body，不是新 hop）。人若要立刻改某一舊篇 → 既有 `POST /dreams/amend`。 |
| 14 | Store／API／UI | **無** migrate hop；boot gate 仍 **≥ 0.36**。`store_version` 出貨時可 stamp `0.38.0`（結構同形，見 AGENTS）。不改 chain GET、不改 Memory 鏈 UI。 |
| 15 | 不靠字數閘門 | **不**用「每段不得超過 N 字／每週不得超過 N 節」當硬失敗。品質靠 prompt＋mock 形狀＋過程句 lint；過擠的稿件仍靠人在 pending **amend**。 |

細節、好／壞例、各層可省略清單以 [chain-prose.md](./docs/chain-prose.md) 為準。

---

## 非目標

- 新 HTTP 欄位或「文風分數」API
- Workbench 記憶鏈 UI／橫向 strip（仍見 [backlog memory-chain-strip](../backlog/memory-chain-strip.md)）
- 歷史 chain 文風或 wikilink **backfill**
- 改 node `{id}.md` standing 骨架；改 ledger 為文章
- 用 linter 判斷「寫得夠不夠好」（除 #10 過程句與既有 0.31「整檔完全沒有 `[[`」）
- 抬 boot gate、新 migrate hop、改 timezone／`memory_language` 機制
- Vector 搜尋、node merge

---

## 實作軌道

### Track A — Prompts

- **做：** 依 [chain-prose.md](./docs/chain-prose.md) 改 extract／dream-files／三份 rollup-write／amend；刪掉「每節一段」「保留下層所有 wikilink」等與本版衝突的句子。
- **不要做：** 改 `rollup-plan.md` 的 execute 規則；改 live 記憶庫。
- **驗收：** 五份 prompt 都寫明海拔、分段、取捨、#8 wikilink；週／月／年明確禁止合訂本。

### Track B — Mock＋soft lint＋phases

- **做：** 調整 rollup mock 形狀；structure-notes 掃過程句；單元測試；`test:phases` 鎖定：higher summary 以 `##` 開頭、無過程句、非 id-bullet dump、仍含 P1、**不是**下層原文單段 paste（見 chain-prose 對 mock 的可測形狀）。
- **不要做：** 因文風讓 dream／approve 失敗；對 ledger 做過程句 lint（本版只掃 `*.summary.md`）。
- **驗收：** `cd server && bun test src/dream/report/structure-notes.test.ts` 涵蓋過程句警告；`bun run test:phases` 綠。

### Track C — 出貨文件

- **做：** `version.md`／`changelog.md`；`docs/domain-language.md` 若 chain summary 一句過時則改；`AGENTS.md` 版本句改為 0.38.0（**不**把本版寫成操作者可打的新 API）。INDEX → shipped。
- **不要做：** 假裝有新端點；改 api.md 行為表（本版無 API 差）。

---

## 驗收 checklist

- [x] `extract.md`／`dream-files.md`：day summary 要求分題＋可多段；禁止多線併題、禁止無關節拍熔一段
- [x] `rollup-write-week.md`／`month`／`year`：取捨／海拔寫清；禁止合訂本；刪「每節預設一段」「保留下層所有 wikilink」
- [x] `amend-dream.md`：改 chain 時適用同一契約
- [x] Wikilink：節內首次 P1、同節可口語；0.31 非回填仍寫在 prompt
- [x] Soft lint：過程句 → Structure notes；不擋 approve
- [x] Mock＋`test:phases` 綠；higher summary 非下層 paste、有 `##`、有 P1、無過程句
- [x] **無** store migrate；boot gate 仍 ≥0.36
- [x] `version.md`／`changelog.md`／AGENTS 版本脈絡＝0.38.0

---

## 錨點檔案（改前必讀）

| 路徑 | 用途 |
|------|------|
| `server/prompts/extract.md` | `chain.summary` 欄：現行「fused full-day narrative」 |
| `server/prompts/dream-files.md` | file pipeline 寫 day summary／P1 |
| `server/prompts/rollup-write-week.md` | 週 writer；「每節一段」＋保留 lower links |
| `server/prompts/rollup-write-month.md` | 月 writer |
| `server/prompts/rollup-write-year.md` | 年 writer |
| `server/prompts/amend-dream.md` | pending 小修 chain |
| `server/src/agent/rollup/mock.ts` | `fuseMockNarrative`：目前收集 lower grains 再拼 |
| `server/src/dream/report/structure-notes.ts` | summary soft lint（0.31 整檔無 `[[`） |
| `server/src/cli/self-test.ts` | Phase 對 month／week summary 形狀的 assert |
| `docs/roadmap/0.31.0/docs/chain-node-wikilinks.md` | P1 存在判定；本版只收窄**密度** |

---

## 與相鄰版本

| | 0.11／既有 rollup | 0.31.0 | 0.37.0 | **0.38.0** |
|--|-------------------|--------|--------|------------|
| 焦點 | 週月年 summary、按生活維度分 `##` | chain 寫入時 P1 | 節點 graph UI | **敘事密度與取捨** |
| 分節 | ✅ 已有 | — | — | 維持；**禁止併題、鼓勵多段** |
| 取捨 | 「concise／fuse」偏熔滿 | 保留 lower 全部 link | 不改 chain 寫入 | **明確可省略；升層丢掉細節** |
| P1 | 無強制 | 提及即 link | 邊不算 chain | **節內首次即可** |
| migrate | 有（當時） | 無 | 無 | **無** |

---

## 開工前仍須拍板

（無。上述已定案足以開工；若 design-review 發現洞，併回本表後再實作。）

---

← [0.37.0](../0.37.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
