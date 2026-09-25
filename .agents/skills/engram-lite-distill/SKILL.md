---
name: engram-lite-distill
description: 把 Engram Lite 的釐清 pending 與暫存 pool 沉澱成日記／週／月／年記並更新 nodes。**本 skill 不寫 asking**（生題由 program 另行開的 engram-lite-clarify-generate session 負責）。使用者要沉澱、整理記憶、寫日記、distill、consolidate 時使用。
---

# 沉澱記憶

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)（含 chain 分題／文體／海拔）。  
調度：[`docs/architecture/orchestration.md`](../../../docs/architecture/orchestration.md)——**program 開兩次獨立 Pi session**；本 skill 只負責 Session A。

記憶庫：`ENGRAM_LITE_STORE_DIR`（環境變數或倉庫根 `.env`；預設 `./demo-engram-lite-data`）。

## 步驟

Vault＝`{store}/memories/`。釐清目錄：`memories/clarify/{asking,pending,history}/`（檔名 `{id}.md`，`id`＝`cla_`＋當地 `YYYYMMDD`＋`_`＋6 位小寫字母數字）。

1. 讀 `{store}/workspace.yaml`。
2. **先消化釐清 pending（與本場 pool 同一場，且必須在處理 `pool/pending.jsonl` 之前）：**
   - 列讀 `memories/clarify/pending/` 每檔。無檔可跳過此步。
   - 把答案／順帶補充（含 `kind: aside`）寫進相關 **chain／nodes**（文體規則與下方相同；不要改成 bullet dump）。
   - 處理完一檔：在 frontmatter 加 `absorbed_at`（RFC3339，當地時區），**移到** `memories/clarify/history/`（不要改 chain 文體規則）。
   - **不要**把釐清檔內容寫進 `pool/pending.jsonl` 或 `archived.jsonl`。
3. 讀 `memories/pool/pending.jsonl`。若 pool pending **與** clarify pending 皆空：說明無事可沉澱，停止（若剛消化過釐清，仍簡短回報已吸收的 id）。
4. 讀相關已存在的 chain 檔與可能對上的 nodes（用 grep／讀檔）。
5. 依事件 `ts` 的**當地日期**更新 chain（文體見下；**何時寫哪一層**見「升層閘門」）：
   - **day（必做）：** `memories/chain/days/YYYY-MM/YYYY-MM-DD.md`
   - **week／month／year：** 只在閘門通過時寫；週記 id＝`YYYY-Www-MMDD`（`MMDD`＝該週週一），檔 `memories/chain/weeks/YYYY-MM/{id}.md`；月／年見 data-spec
   - 讀事件 `attachments[].relationship`（無則當「本則附圖」）；與 day 相關則在 chain 插入**同一**精確 `![[_attachments/uploads/{日}/{檔}]]`；**禁止**寫 `![](/api/attachments/file?path=…)` 等 HTTP URL（Obsidian 只認 wikilink）；禁止發明 path；不要當自己看得見像素
6. **強制新建（create mentions，0.6.1）：** 掃本批 `pool/pending.jsonl` 每則 `raw` 內的 `[@label](node-create:{id})`。對每個去重後的 `id`：**必須**建立（若尚無）`memories/nodes/{id}/{id}.md`（Identity／Relation／Standing facts／Current situation；資訊不足可寫短骨架）。**不得**以「瑣事不開 node」略過 create 意圖。寫入 chain 時，該人物／主題的**第一次**提及用 `[[nodes/{id}/{id}|顯示名]]`（顯示名可用 token 的 label）；不要把 `node-create:` token 原樣抄進 chain。
6a. 此外，對反覆或重要、但**沒有** create token 的人／專案／概念：仍可新建或更新 node（同結構）。純路過、無 create 意圖的瑣事不開 node。事件細節留在 chain，不要把日記抄進 node。wikilink 相對 vault：`[[nodes/{id}/{id}|顯示名]]`。
6b. 若本輪事件影響**近端／長期規劃**：讀寫 `memories/future-sight/upcoming.md` 與／或 `longTerm.md`（整檔 zone 格式，見 data-spec「Future-sight」）。無關則不要動。
7. **不要**在本 skill 寫 `clarify/asking/`。生題由 **另一次** Pi session 跑 `engram-lite-clarify-generate`（program 編排；MIN 3／MAX 5）。若因無事可沉澱而早退，回報即可（program 應跳過 generate）。
8. 將**本批已處理**的 pool pending 列 append 到 `memories/pool/archived.jsonl`，並重寫 `pending.jsonl` 只留未處理列。**先寫完 chain／nodes（與釐清吸收），再動 pool。**

### 釐清 asking 檔格式（僅供 clarify-generate；本 skill 不要新建）

```markdown
---
id: cla_YYYYMMDD_xxxxxx
ts: <RFC3339 當地>
---

（一事一問的問題正文）
```

### 客觀吸收判準（消化 pending 後）

滿足任一即可視為已吸收：相關 day／node 正文出現答案／aside 的關鍵事實；或該檔已在 `history/` 且 frontmatter 含 `absorbed_at`。

## 升層閘門（必須，不要靠「有沒有月度意義」）

「現在」＝`workspace.yaml` timezone 的當地**今天**（真實日期）。

| 層 | 寫的條件（滿足任一即可） | 不要寫 |
|----|--------------------------|--------|
| day | pending 碰到的每一天 | — |
| week | 該 ISO 週已結束（今天 **>** 該週日）；或使用者這次明說要週記 | 本週尚未過完，且沒人點名 |
| month | 該月已結束（今天的 `YYYY-MM` **>** 該月）；或明說要月記 | 當月尚未過完，且沒人點名 |
| year | 該年已結束（今年 **>** 該年）；或明說要年記 | 今年尚未過完，且沒人點名 |

通過閘門之後：

- 寫 week：讀該週週一～週日**全部**日檔再整份取代週記，不是只看本批 pending。
- 寫 month：優先讀與該月日期區間重疊的週記；沒有再退回日檔。
- 寫 year：優先月記。
- 進行中的更高層檔若已存在，也**不要**為這次未結束的時段改寫（除非使用者點名）。
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
