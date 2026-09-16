# 記憶庫規格

根目錄由設定指定，**不**再預設為倉庫內 `data/`。

優先序：

1. 環境變數 `ENGRAM_LITE_STORE_DIR`
2. 專案檔 `engram-lite.yaml` 的 `store_dir`
3. 預設 `./../engram-lite-data`（相對 **engram-lite 倉庫根**，即與 `engram-lite/` 同層的 `engram-lite-data/`）

相對路徑一律相對 engram-lite 根目錄解析。記憶庫內仍是：

```
{store}/
├── workspace.yaml
├── pool/
│   ├── pending.jsonl      # 尚未沉澱
│   └── archived.jsonl     # 已沉澱（審計；可空）
├── chain/
│   ├── days/YYYY-MM/YYYY-MM-DD.md
│   ├── weeks/YYYY-MM/YYYY-Www.md
│   ├── months/YYYY/YYYY-MM.md
│   └── years/YYYY.md
├── nodes/
│   └── {id}/{id}.md
└── jobs/
    └── {job_id}.json      # 僅 server 異步派工；skill 離線流程可不寫
```

合法但無檔 → 視為空，不當作錯誤。

---

## `workspace.yaml`

```yaml
timezone: Asia/Hong_Kong
memory_language: zh-Hant   # zh-Hant | zh-Hans | en
pi_model: deepseek/deepseek-v4.1-flash   # server 派 Pi 用；可被 ENGRAM_LITE_PI_MODEL／PI_MODEL 覆蓋
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
  "note": "可選：skill 梳理後的一句話"
}
```

| 欄位 | 規則 |
|------|------|
| `id` | `evt_` + 日曆日 `YYYYMMDD` + `_` + 6 位小寫字母數字。同檔內唯一 |
| `ts` | RFC3339，含 timezone offset |
| `raw` | 原輸入，不要丟 |
| `note` | 可省略。梳理、分段、標主題時寫在這裡，不要改寫 `raw` 到認不出原句 |

**ingest skill：** 把一次輸入梳理成 1～N 筆，append 到 `pending.jsonl`。不要寫 chain／nodes。

**distill skill：** 只處理 `pending.jsonl`。寫完對應 chain／nodes 後，把那些列移到 `archived.jsonl`。

**ask skill：** 只讀 `chain/`（日週月年）＋ `pool/pending.jsonl`。不讀 `archived.jsonl`、不讀 `nodes/`。已沉澱內容以鏈上敘事為準。

---

## Memory chain

| 層 | id | 路徑 |
|----|----|------|
| day | `YYYY-MM-DD` | `chain/days/YYYY-MM/YYYY-MM-DD.md` |
| week | ISO week `YYYY-Www`（週一～週日） | `chain/weeks/YYYY-MM/YYYY-Www.md`，分組鍵＝該週**週一**所在年月 |
| month | `YYYY-MM` | `chain/months/YYYY/YYYY-MM.md` |
| year | `YYYY` | `chain/years/YYYY.md` |

每層**一個** markdown 檔＝該期敘事（無 ledger／summary 雙檔，無 patch 註記）。

- **已存在：** 讀舊稿，吸收新事件後**整份取代**（不是檔尾 append 流水帳，也不是把舊文與新句拼接成合訂本）。
- **不存在：** 新建完整敘事。
- 正文語言跟 `memory_language`（`zh-Hant`＝繁體中文書面語）。
- **第一行必須是 `##` 題材標題**。不要用日期／週號當頁脊（禁止 `# 2026-09-16`、禁止週一→週日目錄）。

### 分題材、寫成文（對齊 Engram chain 敘事）

**外層＝生命線**（一個 `##`＝一條線或同一主題的弧）。標題由內容長出，約 2–8 字；禁止固定套 `工作`／`家庭`，禁止用逗號把無關線併進同一標題。

**內層＝自然段落。** 預設一事（或同一時間弧的一拍）一段；同一 `##` 下可多段。只把**同一條弧**熔成連續散文。禁止用分號／逗號把無關小事接成一段牆。完整句子，不是專名清單。

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

路徑：`nodes/{id}/{id}.md`。

`id`：小寫 kebab 或短英文／拼音，`[a-z][a-z0-9-]{0,63}`。不要用空白。

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

## Jobs（僅 server）

`jobs/{job_id}.json`：HTTP 派 Pi 時的狀態。欄位見 `docs/api.md`。skills 離線操作**不必**寫這裡。
