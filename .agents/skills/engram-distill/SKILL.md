---
name: engram-distill
description: 把 Engram 的釐清 pending 與暫存 pool 沉澱成日記／週／月／年記並更新 nodes。**本 skill 不寫 asking**（生題由 program 另行開的 engram-clarify-generate session 負責）。使用者要沉澱、整理記憶、寫日記、distill、consolidate 時使用。
---

# 沉澱記憶

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)（含 chain 分題／文體／海拔）。  
調度：[`docs/architecture/orchestration.md`](../../../docs/architecture/orchestration.md)——**program 開兩次獨立 Pi session**；本 skill 只負責 Session A。

記憶庫：`ENGRAM_STORE_DIR`（環境變數或倉庫根 `.env`；預設 `./demo-engram-data`）。

## 步驟

Vault＝`{store}/memories/`。釐清目錄：`memories/clarify/{asking,pending,history}/`（檔名 `{id}.md`，`id`＝`cla_`＋當地 `YYYYMMDD`＋`_`＋6 位小寫字母數字）。

1. 讀 `{store}/workspace.yaml`。
2. **先消化釐清 pending（與本場 pool 同一場，且必須在處理 `pool/pending.jsonl` 之前）：**
   - 列讀 `memories/clarify/pending/` 每檔。無檔可跳過此步。
   - 答案或 aside 能寫成一個事實：把該事實寫進相關 **chain／nodes**（文體規則與下方相同；不要改成 bullet dump）。只覆蓋題目一部分時，只寫答到的那一事實，其餘不要發明。frontmatter 加 `absorbed_at`（RFC3339，當地時區），不要寫 `dismissed_because`。
   - 答案無法寫成事實（沒有內容、明確拒絕、或不是事實）：不要發明 chain／node 正文。frontmatter 加 `dismissed_because`（短原因，trim 後非空），不要寫 `absorbed_at`。
   - 每一檔都要移到 `memories/clarify/history/`。不准留在 `pending/`。半答也算已吸收，不要為了沒答到的子句在這一次補開 asking。
   - **不要**把釐清檔內容寫進 `pool/pending.jsonl` 或 `archived.jsonl`。
3. 讀 `memories/pool/pending.jsonl`。若 pool pending **與** clarify pending 皆空：說明無事可沉澱，停止（若剛消化過釐清，仍簡短回報已吸收的 id）。
4. 讀相關已存在的 chain 檔與可能對上的 nodes（用 grep／讀檔）。
5. 依事件 `ts` 的**當地日期**更新 chain（文體見下；**何時寫哪一層**見「升層閘門」）：
   - **day（必做）：** `memories/chain/days/YYYY-MM/YYYY-MM-DD.md`
   - **week／month／year：** 只在閘門通過時寫；週記 id＝`YYYY-Www-MMDD`（`MMDD`＝該週週一），檔 `memories/chain/weeks/YYYY-MM/{id}.md`；月／年見 data-spec
   - 讀事件 `attachments[].relationship`（無則當「本則附圖」）；與 day 相關則在 chain 插入**同一**精確 `![[_attachments/uploads/{日}/{檔}]]`；**禁止**寫 `![](/api/attachments/file?path=…)` 等 HTTP URL（Obsidian 只認 wikilink）；禁止發明 path；不要當自己看得見像素
6. **強制新建（create mentions，0.6.1）：** 掃本批 `pool/pending.jsonl` 每則 `raw` 內的 `[@label](node-create:{id})`。對每個去重後的 `id`：**必須**建立（若尚無）`memories/nodes/{id}/{id}.md`（Identity／Relation／Standing facts／Current situation；資訊不足可寫短骨架）。**不得**以「瑣事不開 node」略過 create 意圖。寫入 chain 時，該人物／主題的**第一次**提及用 `[[nodes/{id}/{id}|顯示名]]`（顯示名可用 token 的 label）；不要把 `node-create:` token 原樣抄進 chain。
6a. 此外，對反覆或重要、但**沒有** create token 的人／專案／概念：仍可新建或更新 node（同結構）。純路過、無 create 意圖的瑣事不開 node。事件細節留在 chain，不要把日記抄進 node。wikilink 相對 vault：`[[nodes/{id}/{id}|顯示名]]`。
6c. **別名（0.7.0）：** 寫 chain 或新建／更新 node 前，讀已存在主檔的 frontmatter `aliases` 與第一個 H1。已知 id、別名或 H1 顯示名指向該主檔，**不開第二份**。本次使用的顯示名若不在 `aliases`，寫回該主檔。
6d. **空殼：** 只針對**本批開始前就已存在**的 node。Standing facts 與 Current situation 皆空或只有佔位句，本批又出現該 id，仍寫不出可引用事實 → 呼叫刪除腳本（改成純文字並刪目錄）：`bun run .agents/skills/engram-node/scripts/rewrite-links.ts delete --store "{store}" --id "{id}"`。本批 `node-create` 強制建立的骨架**同一輪不得刪**，即使事實區仍空。不要把這條做成程式分類器；由本 skill 判斷。
6b. **未來視（0.9.0）：** 讀 `upcoming.md` 與 `longTerm.md`。每條 yaml 可有 `kind: dated` 或 `kind: intent`。沒有 `kind` 時，`anchor_start` 等於 `anchor_end` 視為 `dated`，否則視為 `intent`；改寫時把 `kind` 寫回去。`anchor_end` 早於當地今天的每一條都要改寫，pool 與 clarify 都空時也要做：
   - `dated` 且有證據已發生：在落點那一天的 day 寫一句（沒有檔就新建），然後從 zone 刪掉該條。
   - 改期，或 `intent` 要續期：條目留在 zone，`anchor_end` 不得早於今天，正文留一句。`intent` 只問要不要繼續，不要寫成已完成或失敗。
   - 放棄：在今天的 day 寫一句（沒有檔就新建），然後從 zone 刪掉該條。
   - 沒有證據就不要選「已發生」。不要在 zone 檔加 `## Closed`。條目裡的電話、診間、地址只留在條目內當提醒；刪條目時不要抄進 node 的 Standing facts，除非使用者事件裡本來就寫了同樣的字。
7. **不要**在本 skill 寫 `clarify/asking/`。生題由 **另一次** Pi session 跑 `engram-clarify-generate`（program 編排；0–5 題，5 是上限）。若因無事可沉澱而早退，回報即可（program 應跳過 generate）。
8. 將**本批已處理**的 pool pending 列 append 到 `memories/pool/archived.jsonl`，並重寫 `pending.jsonl` 只留未處理列。**先寫完 chain／nodes（與釐清吸收），再動 pool。** 這一步必須寫檔；在回覆裡宣稱已清空不算完成。已吸收的釐清檔要移進 `clarify/history/`，不能只在 `pending/` 加上 `absorbed_at`。

### 釐清 asking 檔格式（僅供 clarify-generate；本 skill 不要新建）

```markdown
---
id: cla_YYYYMMDD_xxxxxx
ts: <RFC3339 當地>
---

（一事一問的問題正文）
```

### 客觀吸收判準（消化 pending 後）

已吸收：檔在 `history/` 且 frontmatter 的 `absorbed_at` 非空，沒有 `dismissed_because`。已捨棄：檔在 `history/` 且 `dismissed_because` trim 後非空，沒有 `absorbed_at`。兩種都算這題已離開 pending。半答只要求答到的事實出現在 day 或 node。

## 升層閘門（必須，不要靠「有沒有月度意義」）

「現在」＝ prompt 給的當地今天；沒有該行時，用 `workspace.yaml` timezone 的真實今天。不要用事件 `ts` 或內文裡的日期當作今天。

| 層 | 寫的條件（滿足任一即可） | 不要寫 |
|----|--------------------------|--------|
| day | pending 碰到的每一天 | — |
| week | 未結束的當週：本批日期落在該週就寫同路徑短稿，frontmatter `open: true`，第一個標題仍是 `##` 題材。已結束（今天 **>** 該週日）：整份收成並**刪掉** `open`。使用者這次明說要週記：整份取代；週尚未結束則保留 `open: true` | 另開第二個檔名；把短稿 append 在檔尾 |
| month | 該月已結束（今天的 `YYYY-MM` **>** 該月）；或明說要月記。讀檔時**跳過** `open: true` 的週稿，那些日子改讀 day | 當月尚未過完，且沒人點名；把進行中週稿當月記來源 |
| year | 該年已結束（今年 **>** 該年）；或明說要年記。優先月記，不讀進行中週稿 | 今年尚未過完，且沒人點名 |

本輪若寫了已結束月份裡的日檔，或重寫了與該月重疊的已結束週記，必須接著寫該月月記（月記晚於週記）。本輪若碰到已結束的年份，必須接著寫該年年記（年記晚於月記）。程式會核對這些檔案是否落地。

通過閘門之後：

- 寫 week：讀該週週一～週日**全部**日檔再整份取代週記，不是只看本批 pending。
- 寫 month：優先讀與該月日期區間重疊的週記；沒有再退回日檔。
- 寫 year：優先月記。
- 進行中的月、年若已存在，也**不要**為這次未結束的時段改寫（除非使用者點名）。進行中的週要寫，見上表。
- 收成時刪掉「本週至今」這類未完成口吻與過程旁白。短稿階段可以寫「本週至今」，但機器標記只有 `open: true`。
- 讀檔時若看到**已結束**時段有下層、缺上層檔，可補寫；不必為找洞掃全庫。

ISO 週＝週一至週日；週 id／檔名對齊 Engram（`2026-W30-0720` 表示週一 7/20）；週檔資料夾＝該週**週一**所在 `YYYY-MM`。

## Chain 文體（必須）

對齊 Engram：給人讀的**自然日記散文**，不是事件 dump、不是 patch、不是週一→週日目錄。契約細節亦見 `docs/data-spec.md`「分題材、寫成文」。

### 語言（`memory_language`＝`zh-Hant` 時）

- 正文用**繁體中文書面語**：完整句子、可讀敘事。
- **禁止**口語粵語（例如「食飯」「睇報告」「搞掂」當正文主幹）、聊天腔、網路梗、表情符號堆砌。
- 專有名詞、人名、店名、專案代號可保留原文；敘述句仍須書面語。

### 結構規則

1. **先問該層的問題，再決定留什麼。**
   - Day：這天發生了哪些有內容的事？（可多則、可不相干）
   - Week：這週重心是哪幾條線？線內大致何時發生？
   - Month：這個月的節奏與轉折
   - Year：這年被什麼定義
2. **分題材。** 外層＝生命線：一個 `##`＝一條線。標題由內容長出（約 2–8 字），不要固定「工作／家庭」。禁止把無關線併進同一標題（**禁止逗號併題**）。日有 ≥2 條有內容的線 → ≥2 個 `##`。週／月／年常見 2–4 節；**節序＝重要性**，不是日曆序。
3. **一段一拍。** 完整句子。預設一事（或同一弧）一段；同節可多段。只熔同一條時間弧。禁止分號／逗號牆把 brunch、買菜、運動、發版接在一段。
4. **週／月／年必須取捨。** 下層有的不必都出現。合訂本（把各日全文串起來）是失敗寫法。省略不是刪記憶。預設丟掉菜單、完整地址、每次運動分鐘、逐次版號。
5. **時間錨。** 週寫週三／週末／日期；月寫上旬／下旬；年寫季節或月份。禁止無指涉的「這天／今日」。
6. **檔案形狀。** 整份取代。第一行必須是 `## …`。不要 `# 日期`、不要 `## Current`／`## History`、不要過程旁白（「已寫入」「Writing the summary」）。

### 好／壞例（虛構；勿當真人記憶）

以下人物、店、專案皆捏造，僅示範形狀。

#### Day — 壞（併題＋逗號牆）

```markdown
## 翠湖體檢排期，海港晚飯與河堤散步，Beacon 1.4

虛構角色甲上午已完成翠湖體檢；下一步 2026-03-21 …（地址全文）… 晚間與虛構家庭在海港茶餐廳用餐；同日 Beacon 發布 1.4。
```

#### Day — 好（分題、可碎）

```markdown
## 翠湖體檢

[[nodes/fict-a/fict-a|虛構角色甲]] 上午完成就診。下一步 2026-03-21 10:45–11:45 檢查，2026-04-05 由林醫師覆看報告。同日牙醫與提早到達撞期，打算自行改期。

## 海港與河堤

晚間與虛構家庭在海港茶餐廳用餐；之後與 [[nodes/fict-b/fict-b|虛構角色乙]] 到河堤散步。

## Beacon

同日發布 [[nodes/beacon/beacon|Beacon]] 1.4。
```

#### Week — 壞（合訂本）

把週一到週日的店名、菜單、運動分鐘、每次 `1.0`…`1.4` 全寫進兩三段，幾乎等於七篇日記串接——這是失敗寫法。

#### Week — 好（取捨）

```markdown
## Beacon／助理

本週產品線從附件與釐清連發，到週四接通測試用 bot、架起本機與雲端對齊，週末再到 1.4。重心是「助理可從手機喚起、資料對齊」，不是每一版的功能清單。

## 體檢

週六完成翠湖體檢；檢查約在 2026-03-21，報告約在 2026-04-05。牙醫撞期須自行改期。

## 二人日常

試妝、看展、樓下用餐與河堤散步仍在。週末早午餐踩雷後改去會所運動；[[nodes/fict-b/fict-b|虛構角色乙]] 打算開始準備上班午餐盒。
```

（週記可以寫「連發」，不必把 1.0–1.4 的 release note 重寫一遍。）

## 回覆

簡短列出：吸收的 clarify id、寫／改的 chain／node 路徑、archive 的 pending 筆數。  
**不要宣稱已出題**（那是下一 session 的 clarify-generate）。
