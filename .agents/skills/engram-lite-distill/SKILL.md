---
name: engram-lite-distill
description: 把 Engram Lite 暫存 pool 沉澱成日記／週記／月記／年記，並新建或補充 nodes。在使用者要沉澱、整理記憶、寫日記、distill、consolidate 時使用。Chain 必須分題材（##）寫成自然文體，不是流水帳或合訂本。
---

# 沉澱記憶

契約：[`docs/data-spec.md`](../../../docs/data-spec.md)（含 chain 分題／文體／海拔）。

記憶庫：`engram-lite.yaml` 的 `store_dir` 或 `ENGRAM_LITE_STORE_DIR`（預設 `./../engram-lite-data`）。

## 步驟

1. 讀 `workspace.yaml`、`pool/pending.jsonl`。若 pending 空：說明無事可沉澱，停止。
2. 讀相關已存在的 chain 檔與可能對上的 nodes（用 grep／讀檔）。
3. 依事件 `ts` 的**當地日期**更新 chain（文體見下；**何時寫哪一層**見「升層閘門」）：
   - **day（必做）：** `chain/days/YYYY-MM/YYYY-MM-DD.md`
   - **week／month／year：** 只在閘門通過時寫；路徑與 id 見 data-spec
4. 對反覆或重要的人／專案／概念：新建或更新 `nodes/{id}/{id}.md`（Identity／Relation／Standing facts／Current situation）。瑣事不開 node。事件細節留在 chain，不要把日記抄進 node。
5. 將**本批已處理**的 pending 列 append 到 `pool/archived.jsonl`，並重寫 `pending.jsonl` 只留未處理列。**先寫完 chain／nodes，再動 pool。**

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

ISO 週＝週一至週日；週檔資料夾＝該週**週一**所在 `YYYY-MM`。

## Chain 文體（必須）

對齊 Engram：給人讀的敘事，不是事件 dump、不是 patch、不是週一→週日目錄。

1. **先問該層的問題，再決定留什麼。**
   - Day：這天發生了哪些有內容的事？（可多則、可不相干）
   - Week：這週重心是哪幾條線？線內大致何時發生？
   - Month：這個月的節奏與轉折
   - Year：這年被什麼定義
2. **分題材。** 外層＝生命線：一個 `##`＝一條線。標題由內容長出（約 2–8 字），不要固定「工作／家庭」。禁止把無關線併進同一標題。日有 ≥2 條有內容的線 → ≥2 個 `##`。週／月／年常見 2–4 節；**節序＝重要性**，不是日曆序。
3. **寫成文。** 完整句子。預設一事（或同一弧）一段；同節可多段。只熔同一條時間弧。禁止逗號牆把 brunch、買菜、運動、發版接在一段。
4. **週／月／年必須取捨。** 下層有的不必都出現。合訂本（把各日全文串起來）是失敗寫法。省略不是刪記憶。預設丟掉菜單、完整地址、每次運動分鐘、逐次版號。
5. **時間錨。** 週寫週三／週末／日期；月寫上旬／下旬；年寫季節或月份。禁止無指涉的「這天／今日」。
6. **檔案形狀。** 整份取代。第一行必須是 `## …`。不要 `# 日期`、不要 `## Current`／`## History`、不要過程旁白（「已寫入」「Writing the summary」）。
7. **wikilink。** 該節首次提到已知或本批新建 node：`[[nodes/{id}/{id}|顯示名]]`；其後口語名即可。不發明路人 link。

語言跟 `memory_language`。`zh-Hant`＝繁體中文書面語，不用口語／網路腔。

好的日稿形狀：

```markdown
## Acme 限流

早上與 [[nodes/alice/alice|Alice]] 開會，[[nodes/acme/acme|Acme]] 仍回 429。下一步是對齊配額。

## 另一條線

（僅當當天確有第二條線。）
```

## 禁止

- 不要走 Engram 的 dream／approve／git
- 不要用 bash 改檔；用 read／edit／write
- 不要刪 `archived.jsonl` 舊列
- 不要把 chain 寫成 id bullet 清單或 pending 原文堆疊

## 回覆使用者

列出更新的 chain id、node id、移入 archived 的事件 id。短。不要把日記全文貼回對話。
