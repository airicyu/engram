# 0.3.1 — Chain 日記文體：自然敘事質感（借鏡 Engram 0.38）

← [changelog](../../../changelog.md) · 上游：[0.3.0](../0.3.0/INDEX.md)（`planned`）· current: [version.md](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** **shipped**（2026-09-21）  
> 範圍：**只改寫作契約與 distill／rollup 相關 skill 文案**（必要時同步 `docs/data-spec.md` 文體小節）。**不改** server 規則引擎、不改 HTTP、不改 vault 目錄形狀。  
> **開工前仍須拍板：無。** 執行走 `.agents/skills/roadmap-version`；閘門未過不要實作。

## 產品句

沉澱後的 day／week／month／year chain 讀起來像**自然日記散文**（繁體書面語、分題、一事一段、週月年有取捨），質感對齊已調校的完整 Engram chain 敘事，而不是條列報告或逗號牆流水帳。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | paste-ready、禁區 |
| 1 | **本檔 INDEX** | 範圍、定案、驗收 |
| 2 | [docs/how.md](./docs/how.md) | 改哪些檔、借哪些 Engram 句子、好／壞例怎麼寫進 skill |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何不搬 dream staging／雙檔 chain；為何只動 skill／契約文 |

## 與上一版／Engram 對照

| 面向 | 現況（0.2／0.3 契約） | 本版 |
|------|----------------------|------|
| 結構契約（分題、海拔、取捨、禁逗號牆） | `docs/data-spec.md` Memory chain 與 distill skill **已有**對齊 Engram 0.38 的條列 | **保留**；不重造第二套結構 |
| 文風質感 | 規則在，但缺好／壞例；書面語禁令偏弱；文體段埋在作業步驟裡 | 獨立「Chain 文體」小節＋虛構好／壞例＋書面語硬禁令 |
| Engram 運行時 | `server/prompts/extract.md`、`dream-files.md`、`rollup-write-*.md`＋`docs/roadmap/0.38.0/docs/chain-prose.md` | **只借鏡文案與例句**；不引入 Engram prompt 管線或 draft／approve |

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 改什麼 | **文案／契約 only：** `.agents/skills/engram-lite-distill/SKILL.md`（必改）；若倉庫另有 week／month／year 專用寫作指示則一併對齊；`docs/data-spec.md`「分題材、寫成文」小節補強與 skill **同義**（不發明第三套文風）。**可選：** 極短 `docs/architecture/chain-prose.md` 指向 data-spec＋skill，方便人讀——非必須。 |
| 2 | 借鏡來源（唯讀） | 完整 Engram 倉庫（常見路徑 `../engram` 或本機 sibling `engram/`）：`docs/roadmap/0.38.0/docs/chain-prose.md`、`server/prompts/extract.md`（chain.summary 欄義務）、`server/prompts/dream-files.md`（Day summary shape）、`server/prompts/rollup-write-week.md`（及 month／year 若需對齊海拔用語）。 |
| 3 | 必須寫進 distill skill 的「Chain 文體」獨立小節 | 須**獨立標題**（勿只散落在步驟 5），且語意覆蓋：(a) **繁體書面語**（`memory_language`／workspace 為 `zh-Hant` 時）：繁體中文書面語，**禁止**口語粵語、聊天／網路腔；(b) **分題**：一個 `##`＝一條生命線；≥2 條有內容的線 → ≥2 個 `##`；禁止逗號併題；(c) **一段一拍**：預設一事或同一時間弧一段；禁止分號／逗號牆熔無關小事；(d) **週／月／年取捨**：合訂本＝失敗；預設省略菜單、完整地址、每次運動分鐘、逐次版號；(e) **時間錨**：禁止無指涉的「這天／今日」；(f) **檔案形狀**：整份取代；第一行 `##`；禁止過程旁白（「已寫入」「Writing the summary」）。 |
| 4 | 好／壞例 | skill 內至少各一組 **Day 壞／好**、**Week 壞／好**（可縮寫自 Engram 0.38 §6）。**必須虛構**人名／店／專案（如「北灣體檢」「燈塔茶餐廳」「Harbor 1.4」類捏造）。**禁止**寫入真人真事、真人姓名、真實喜帖／婚禮／伴侶私事（VIP：見根目錄 `AGENTS.md`）。 |
| 5 | 不做的架構 | **禁止**引入 Engram dream staging、approve／discard、day ledger＋summary 雙檔、`*.summary.md` 第二檔、server 文風 linter 當硬失敗、把文體判斷寫進 TypeScript 規則引擎。Program 仍只做控制面（含既有 distill→clarify-generate 編排）。 |
| 6 | 與 0.3.0 關係 | 本版可與 0.3.0 **並行排程**；不依賴搜尋／附圖／節點圖 UI。若兩版同時改同一 skill 檔，實作 agent 須 rebase／合併文案，不得覆蓋 0.3.0 已定案的「distill 不寫 asking／clarify-generate 另 session」等句。 |
| 7 | 測試 | 以 **skill／data-spec 字串契約測試**為主（`bun test`：斷言 SKILL.md／data-spec 含書面語禁令、獨立文體小節標題、至少一組好例／壞例標記或標題）。**不**要求打真人 vault；**不**強制新增 live LLM 文風評分。若倉庫已有 distill fixture 測，可加「輸出不得整段 paste 下層」之類機械斷言——可選，非本版閘門。 |
| 8 | 出貨 | 驗收勾完 → `version.md`＝`0.3.1`、`changelog.md` 記一筆；狀態 → `shipped`。**不要 git commit，除非使用者明確要求。** |

## 開工前仍須拍板

無。

## 非目標

- 重寫 ingest／ask／clarify-generate 的主流程（除非為避免文案互相矛盾而改一字一句交叉引用）
- Server 新增文風 API、打分、自動 rewrite job
- 搬 Engram `server/prompts/*` 檔進 lite 當運行時依賴
- 改變 chain 路徑、frontmatter、升層閘門邏輯（閘門規則維持 data-spec／既有 skill；本版只強化**寫成什麼樣子**）
- UI 改版
- 用真人 `demo-engram-lite-data` 或私人日記當 roadmap／測試例句

## 驗收

- [x] `engram-lite-distill` skill 有**獨立**「Chain 文體」（或同等標題）小節，且涵蓋已定案 #3 的 (a)–(f)
- [x] 該小節含 **Day 好／壞** 與 **Week 好／壞** 虛構例句（或等價對照）；全文無真人隱私
- [x] `docs/data-spec.md` Memory chain 文體段與 skill **同義**（書面語、分題、一段一拍、週月年取捨）；無第三套互相衝突的文風
- [x] 未新增 Engram 式 dream staging／雙檔 summary／server 文風規則引擎
- [x] `bun test` 全綠；含本版字串契約斷言（見已定案 #7）
- [x] `version.md`／`changelog.md` 已更新（出貨時）

## 實作軌道

| Track | 做 | 不要 |
|-------|----|------|
| A 文案 | distill skill 獨立文體小節＋好壞例；data-spec 對齊 | 改 program 語意判斷 |
| B 測試 | bun 字串契約測 | 打真人 store |
| C 出貨文件 | changelog／version（閘門與實作完成後） | 擅自 commit |

## 錨點

`.agents/skills/engram-lite-distill/SKILL.md`  
`docs/data-spec.md`（Memory chain／分題材、寫成文）  
（唯讀借鏡）`../engram/docs/roadmap/0.38.0/docs/chain-prose.md`  
（唯讀借鏡）`../engram/server/prompts/extract.md`、`dream-files.md`、`rollup-write-week.md`  
`AGENTS.md`（VIP：測試／demo 嚴禁真人真事）  
`.agents/skills/roadmap-version/SKILL.md`

← [0.3.0](../0.3.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
