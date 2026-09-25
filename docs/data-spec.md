# 記憶庫規格

根目錄由設定指定，**不**再預設為倉庫內 `data/`。

優先序：

1. 環境變數 `ENGRAM_LITE_STORE_DIR`
2. 倉庫根 `.env` 的 `ENGRAM_LITE_STORE_DIR`（gitignored；見 `.env.example`）
3. 預設 `./demo-engram-lite-data`（相對 **engram-lite 倉庫根**）

HTTP 埠同樣：`ENGRAM_LITE_PORT` → `.env` 的 `ENGRAM_LITE_PORT` → `8797`。

本倉庫附帶的 `demo-engram-lite-data/` 是可提交的**虛構**示範庫；未設時即用此路徑。自己的記憶請在 `.env` 或環境變數把 `ENGRAM_LITE_STORE_DIR` 指到倉庫外（例如 `./../engram-lite-data`）。**VIP：** 嚴禁把 personal private 真人真事寫進 `demo-engram-lite-data/` 或任何 testing／fixture（對齊 Engram；見根目錄 `AGENTS.md` VIP 規則）。

相對路徑一律相對 engram-lite 根目錄解析。記憶庫內：

```
{store}/                          # ENGRAM_LITE_STORE_DIR
├── workspace.yaml                # 不進 vault
├── jobs/
│   └── {job_id}.json             # 僅 server 派工；不進 vault（對齊 Engram 的 dreams/）
└── memories/                     # Obsidian vault（開這一層，不要開 store 根）
    ├── _attachments/
    │   └── uploads/YYYY-MM-DD/   # 附圖；embed：![[_attachments/uploads/{日}/{檔}]]
    ├── clarify/
    │   ├── asking/               # 待人答（clarify-generate 新建；distill 不寫）
    │   ├── pending/              # 已答／aside，等下次 distill 吸收
    │   └── history/              # 已吸收或 dismissed
    ├── pool/
    │   ├── pending.jsonl         # 尚未沉澱
    │   └── archived.jsonl        # 已沉澱（審計；可空）
    ├── chain/
    │   ├── days/YYYY-MM/YYYY-MM-DD.md
    │   ├── weeks/YYYY-MM/YYYY-Www-MMDD.md
    │   ├── months/YYYY/YYYY-MM.md
    │   └── years/YYYY.md
    ├── future-sight/
    │   ├── upcoming.md              # 近端錨點（zone 檔，見下）
    │   └── longTerm.md
    └── nodes/
        └── {id}/{id}.md
```

合法但無檔 → 視為空，不當作錯誤。

舊庫若 `chain`／`nodes`／`pool` 仍在 `{store}/` 根下，移進 `memories/` 即可；`jobs/` 與 `workspace.yaml` 留在 store 根。

Obsidian 開 `{store}/memories/`。`[[nodes/…]]` 與 `![[_attachments/uploads/…]]` 都相對這一層，圖與日記同庫可見。

---

## `workspace.yaml`

```yaml
timezone: Asia/Hong_Kong
memory_language: zh-Hant   # zh-Hant | zh-Hans | en
pi_model: deepseek/deepseek-v4.1-flash   # server 派 Pi 用；可被 ENGRAM_LITE_PI_MODEL／PI_MODEL 覆蓋
future_sight_window_days: 365   # 可省略；可被 ENGRAM_LITE_FUTURE_SIGHT_WINDOW_DAYS 覆蓋
future_sight_upcoming_days: 30  # 可省略；可被 ENGRAM_LITE_FUTURE_SIGHT_UPCOMING_DAYS 覆蓋
```

發生日時一律用此 timezone 解讀／寫入 offset。  
`pi_model` 只影響 **Bun server 呼叫 SDK**；終端機直接跑 `pi` 仍用 `~/.pi/agent/settings.json`。

---

## 事件 pool

`pending.jsonl`／`archived.jsonl`：一行一個 JSON 物件，**UTF-8**，唯附加為主；沉澱時允許 **整檔重寫** `pending.jsonl`（留下未處理列）並把已處理列 **append** 到 `archived.jsonl`。

```json
{
  "id": "evt_20260916_a1b2c3",
  "ts": "2026-09-16T22:10:00+08:00",
  "raw": "使用者原句",
  "note": "可選：skill 梳理後的一句話",
  "attachments": [
    {
      "path": "_attachments/uploads/2026-09-16/menu.png",
      "relationship": "當日菜單"
    }
  ]
}
```

| 欄位 | 規則 |
|------|------|
| `id` | `evt_` + 日曆日 `YYYYMMDD` + `_` + 6 位小寫字母數字。同檔內唯一 |
| `ts` | RFC3339，含 timezone offset |
| `raw` | 原輸入，不要丟。可含精確 `![[_attachments/uploads/{日}/{檔}]]`（禁 `|alias`） |
| `note` | 可省略。梳理、分段、標主題時寫在這裡，不要改寫 `raw` 到認不出原句 |
| `attachments` | 可省略或空陣列（與無圖的 0.2 相同）。非空時每項 `path`（vault 相對、形如 `_attachments/uploads/{日}/{檔}`）＋`relationship`（trim 後非空）。**對稱：** 若 `raw` 含任一合法 embed，或本陣列非空，則 embed path 集合與 `attachments[].path` 集合必須相等（順序不論；重複先集合正規化）。缺漏、缺檔、`|alias`、非法 path → 寫入端拒絕 |

**ingest skill：** 把一次輸入梳理成 1～N 筆，append 到 `memories/pool/pending.jsonl`。不要寫 chain／nodes。**不要**新建釐清題（生題由 program 在 distill 之後另開 session 跑 `engram-lite-clarify-generate`）。

**distill skill：** 每次先讀 `memories/clarify/pending/`，把答案／aside 寫進相關 chain／nodes，再移到 `clarify/history/`（可加 `absorbed_at`）。然後處理 `memories/pool/pending.jsonl`：寫完對應 chain／nodes 後，把那些列移到 `archived.jsonl`。**不要**在本 skill 寫 `clarify/asking/`。讀事件 `attachments[].relationship`（無則當「本則附圖」）；day 相關則插入**同一**精確 embed；禁止發明 path、禁止當自己看得見像素。

**ask skill：** 只讀 `memories/chain/`（日週月年）＋ `memories/pool/pending.jsonl`。不讀 `archived.jsonl`、不讀 `nodes/`、**不讀 `clarify/`**。已沉澱內容以鏈上敘事為準。

---

## Memory chain

| 層 | id | 路徑 |
|----|----|------|
| day | `YYYY-MM-DD` | `memories/chain/days/YYYY-MM/YYYY-MM-DD.md` |
| week | ISO week id `YYYY-Www-MMDD`（`Www`＝ISO 週序；`MMDD`＝該週**週一**月日，無連字號；週一～週日） | `memories/chain/weeks/YYYY-MM/{week_id}.md`；`{YYYY-MM}`＝週一所在日曆月。`MMDD` 與 ISO 週一不符 → 非法 id（對齊 Engram） |
| month | `YYYY-MM` | `memories/chain/months/YYYY/YYYY-MM.md` |
| year | `YYYY` | `memories/chain/years/YYYY.md` |

每層**一個** markdown 檔＝該期敘事（無 ledger／summary 雙檔，無 patch 註記）。

- **已存在：** 讀舊稿，吸收新事件後**整份取代**（不是檔尾 append 流水帳，也不是把舊文與新句拼接成合訂本）。
- **不存在：** 新建完整敘事。
- 正文語言跟 `memory_language`。`zh-Hant`＝**繁體中文書面語**（完整句子、自然日記散文）；**禁止**口語粵語、聊天腔、網路梗寫進 chain 正文。
- **第一行必須是 `##` 題材標題**。不要用日期／週號當頁脊（禁止 `# 2026-09-16`、禁止週一→週日目錄）。

### 分題材、寫成文（對齊 Engram chain 敘事）

**外層＝生命線**（一個 `##`＝一條線或同一主題的弧）。標題由內容長出，約 2–8 字；禁止固定套 `工作`／`家庭`，禁止用逗號把無關線併進同一標題。

**內層＝自然段落。** 預設一事（或同一時間弧的一拍）一段；同一 `##` 下可多段。只把**同一條弧**熔成連續散文。禁止用分號／逗號把無關小事接成一段牆。完整句子，不是專名清單。寫 chain 時**不要**寫過程旁白（例如「已寫入」「Writing the summary」）。

日有 ≥2 條有內容的線 → ≥2 個 `##`。週／月／年常見 2–4 節（薄時段可 1 節）；**節的排序＝對該時段的重要性**，不是日曆順序。節內才按時間早→晚。

| 層 | 要回答的問題 | 預設留 | 預設省略（留給更低層） |
|----|----------------|--------|------------------------|
| day | 這天發生了哪些有內容的事？（可多則、可不相干） | 具體情節：誰、何處、重要數字／鐘點、當天感受一句 | 尚未發生的週回顧；把無關線焊在一起 |
| week | 這週**重心**是哪幾條線？ | 轉折、決定、會影響後續的事、一兩筆有意味的日常 | 菜單、完整地址、每次運動分鐘、**每一**版號（可寫成「本週連發 …」） |
| month | 這個月的**節奏**與轉折 | 上旬／中旬／下旬走向、線與線的關係 | 單日店名＋菜名、週層鐘點表、版號逐日清單 |
| year | 這年被什麼定義 | 季節或上／下半年通過線 | 月層段落複述、專案每次小版本 |

週／月／年**必須取捨**：下層有的不必都出現。把七篇日文串成週記＝失敗寫法。省略不是刪記憶——日檔仍在。

時間錨：日＝當天情節自明；週＝週一／週末／`YYYY-MM-DD`；月＝上旬／下旬；年＝季節或月份。禁止無指涉的「這天／今日」。

wikilink：該 `##` 節**第一次**提到已存在（或本批新建）的 node 用 `[[nodes/{id}/{id}|顯示名]]`；同節後文口語名即可。不發明路人 link。整拍省略則 link 也省略。

```markdown
## Acme 限流

早上與 [[nodes/alice/alice|Alice]] 開會，[[nodes/acme/acme|Acme]] 的 API 仍回 429。下一步仍是對齊配額，不是另開一條產品線。

## 其餘

（僅當確有第二條線才另開節；不要為了湊結構空寫。）
```

### 何時寫 day／week／month／year

「現在」＝`workspace.yaml` 的 timezone 下的**當地日曆日**（真實時鐘；Lite 無虛擬鐘）。

| 層 | 何時寫／整份更新 |
|----|------------------|
| **day** | **必寫。** pending 裡每筆事件的當地日期，更新對應日檔。 |
| **week** | 僅當該 ISO 週**已結束**，或使用者**這次明確要求**寫週記。已結束＝當地今日 **晚於** 該週星期日。 |
| **month** | 僅當該日曆月**已結束**（當地今日的 `YYYY-MM` **大於** 該月），或使用者這次明確要求寫月記。 |
| **year** | 僅當該日曆年**已結束**（當地今年 **大於** 該年），或使用者這次明確要求寫年記。 |

順序：先寫本批碰到的 **day** → 再對「已結束或被點名」的週寫 **week**（讀該週**全部**已有日檔，不只本批）→ 同理 **month**（優先讀重疊的週記；沒有週記再靠日檔）→ 同理 **year**（優先月記）。

仍在進行中的週／月／年：**不要**為了這次 distill 新建或改更高層。日檔照寫。之後該時段結束，下一次 distill（或使用者點名）再升層。

補洞：讀檔時若發現某**已結束**時段已有下層、卻缺對應週／月／年檔，可以順便補寫；不要為了找洞而掃遍整個 vault。

未結束也要寫時，使用者須明說（例如「連本週週記」「未結束的月也寫」）。沒說就當不寫。

---

## Nodes

路徑：`memories/nodes/{id}/{id}.md`。Vault 內 wikilink 仍寫 `[[nodes/{id}/{id}|顯示名]]`（相對 `memories/`）。

`id`：目錄名＝主檔名＝wikilink 兩段 path。**允許 Unicode**（含中文）；禁止 `/`、`\`、`..`、空字串（對齊 Engram）。新建時仍建議英文 kebab／拼音以利 URL，非硬性。

主檔建議四段（可缺，但新建時盡量齊）：

```markdown
# 顯示名

## Identity

這是誰／什麼。

## Relation

與其他節點的關係。可用 `[[nodes/alice/alice|Alice]]`。

## Standing facts

穩定事實（較少改）。

## Current situation

目前狀態（隨沉澱更新）。
```

**distill：** 事件裡反覆或重要的人／專案／概念 → 新建或補這四段。不要為一次性瑣事開 node。

---

## Future-sight（未來視）

路徑：`memories/future-sight/upcoming.md`、`memories/future-sight/longTerm.md`（對齊 Engram 0.40+；**無** per-id `active/` 檔）。

每檔＝zone frontmatter＋多個 `## {id}` 區塊。每區塊：`## {id}` → fenced `yaml`（`anchor_start`／`anchor_end`）→ 正文段落。例 id：`fs-example-deadline`。

| 規則 | 說明 |
|------|------|
| `id` | `[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}` |
| `anchor_start`／`anchor_end` | `YYYY-MM-DD`，含起迄；`anchor_end`＜當地今日 → 過期 |
| zone | `upcoming`＝近端檔；`longTerm`＝較遠檔（**不**在 GET 時自動重分桶；distill／skill 依事件改寫整檔） |

**`GET /future-sight`：** expire-only——移除過期項、各寫一筆敘述事件到 `pool/pending.jsonl`（機械文字，非 Pi）；成功後可 store git commit。詳見 `docs/api.md`。

**ask skill：** 可讀兩個 zone 檔（與 chain、pending 並用）。**distill：** 本輪事件影響近端規劃時，可整檔改寫 `upcoming.md`／`longTerm.md`（勿發明過窗 anchor；窗長見 workspace）。

---

## Clarify（釐清）

路徑：`memories/clarify/{asking,pending,history}/{id}.md`。

| 規則 | 說明 |
|------|------|
| `id` | `cla_`＋當地 `YYYYMMDD`＋`_`＋6 位小寫字母數字；檔名＝`{id}.md` |
| frontmatter | 至少 `id`、`ts`（RFC3339）。aside 另必含 `kind: aside` |
| asking | 待人答；**只** `engram-lite-clarify-generate` skill（program 在 distill 之後另開 session）新建 3–5 題（一事一問）。distill **不**寫 asking |
| pending | 已答（submit 寫入 `## Answer` 後移入）或 aside 直接新建；等下次 distill 吸收。aside **不是** pool 事件 |
| history | 已吸收，或 DELETE asking 時標 dismissed 後移入 |

Ingest／`POST /events`／server **不**生成問題。Ask **不**讀本目錄。Keyword `GET /search` **不**掃 `clarify/`。

## Attachments

實體：`memories/_attachments/uploads/{YYYY-MM-DD}/{filename}`（**無 tmp**）。  
上傳：`POST /attachments` multipart `file`；MIME 僅 `image/jpeg`｜`image/png`｜`image/webp`｜`image/gif`；上限 10 MiB；檔名單一段、禁 `..`／`/`；衝突則 `{stem}-{HHmmss}-{rand6}.ext`。  
讀取：`GET /attachments/file?path=` 僅允許上款 path 形。  
Chain／事件引用用精確 `![[_attachments/uploads/{日}/{檔}]]`（相對 vault；不要含 `|alias`）。各層只重複同一路徑，不複製檔案。Server **不**組 Engram 式 appendix；關係只存在事件 `attachments[]`。

## 搜尋範圍（機械 `GET /search`）

掃 `memories/chain/**/*.md`、`memories/nodes/**/*.md`、`memories/future-sight/*.md`、`memories/pool/pending.jsonl`（正文／`raw`／`note`）。**不**掃 `archived.jsonl`、`jobs/`、`clarify/`、`_attachments` bytes。詳見 `docs/api.md`。

## 節點圖（機械 `GET /nodes/graph`）

點＝現有 node id；邊＝各 `nodes/{id}/{id}.md` 內指向其他現存 node 的 wikilink（無向去重）。**不**經 Pi、**不**用 score。詳見 `docs/api.md`。

## Store git（0.3.2）

- Git 根＝**store 根**（`ENGRAM_LITE_STORE_DIR`），**local only**（預設無 remote；文件不建議 push 私人 store）。
- **觸發：** server 機械寫入或 distill job **成功終態**、reset skill 成功清空後，program 呼叫 `commitStore`（skills **不**負責 git）。純 pi-agent 直寫 vault 不在範圍。
- **追蹤：** `memories/`、`workspace.yaml`（若存在）。**忽略：** `jobs/`、OS 垃圾（store 根 `.gitignore`）。
- **失敗：** 業務已成功則不回滾；git 失敗只 log。
- Message 形如 `engram-lite: event evt_…`（禁止正文）。

## Jobs（僅 server）

`{store}/jobs/{job_id}.json`：HTTP 派 Pi 時的狀態。欄位見 `docs/api.md`。skills 離線操作**不必**寫這裡。不要把 jobs 放進 `memories/`。
