# 0.11.0 — 設計推理與背景（為何這樣定）

← [INDEX](../INDEX.md)

> **給實作 agent／日後改契約的人：** 本檔記錄討論時的 **motivation 與反例**。  
> **做什麼、路徑、流程** 以 [INDEX](../INDEX.md)、[store-layout.md](./store-layout.md)、[rollup-pipeline.md](./rollup-pipeline.md) 為準。  
> 若實作時想改已定案，先讀本檔對應段落；改動必須能回答「原本要防的失敗模式是否仍成立」。

---

## 1. 為何現在做 week／month／year

- MVP（`docs/roadmap/0.1.0/docs/memory-chain.md`）已預留 `weeks/`、`months/`、`years/` 目錄與關帳構想，但 **從未落地**。
- 現行只有 **day** chain（ledger + summary）。`data-demo`（replay）跨多月時，Memory browse 只能逐日翻，沒有「6 月整體發生什麼」的敘事層。
- 目錄空殼容易被誤以為「漏跑了 month」——需要文件與產品行為對齊：**以前沒做是 expected；0.11 才做。**

---

## 2. 為何否定「closed = 跑過就不再跑」

MVP 曾寫：用 `closed_weeks.yaml`／`closed_months.yaml` 做關帳冪等，已關閉的 id 不再關帳。

### 反例（必須能撐住）

```
6/30 23:00 入睡  → 6 月尚未結束 → 不應滾 6 月 summary
7/1  22:00 入睡  → 6 月已結束 → 滾 6 月，記入「已處理」
7/2  日間補記 6/29 某事 → 當晚入夢 → day chain 補回 6/29
                     → 若「已處理就不跑」→ 月鏈永遠丟了這筆補記
```

**在意的是：** 真實使用會 **補記過去 occurrence 日**；高階 chain 必須能跟著 revise，不能因「日曆月已關過一次」就凍結。

### 因此定案

| 概念 | 意義 |
|------|------|
| **initialized** | 該 week／month／year block **曾經成功 init 過**（approve 後標記）；用於 init 冪等／快速知道檔案應已存在 |
| **不是 freeze** | initialized 之後，只要本輪 planner 判 Y，writer 仍可 **revise** summary |

「現在該不該滾這個區間」（例如月底最後一天晚上不要滾當月）→ 交給 **planner 的 Y/N**，不要塞進 initialized 語意。

檔名建議用 `initialized_weeks.yaml` 等，避免繼續叫 `closed_*` 造成誤讀。亦可「檔案存在＝已 init」，yaml 當索引；見 store-layout／rollup 定案。

---

## 3. 為何高階只要 summary、不要 ledger

Day 雙軌（ledger append + summary revise）是因為：同日多次入夢需要 **稽核鏈**，又要可讀敘事。

Week／month／year 若再做 ledger，實務上容易變成：

- 把下層 day／week 內容 **再 dump 一層**，與下層重複；
- 或變成無意義的「又一次 append 日誌」，人審與 search 噪音上升。

**在意的是：** 高階是 **不同粒度的融合敘事**，不是第二份稽核 log。  
追溯補記：日鏈仍用 summary `## History`；**week／month／year 只保留最新 snapshot**（revise 整份覆寫，不沉 History）。

寫入形態：draft 產全文 → approve 時 **replace** 整份高階 summary 檔（init＝新建檔）。高階沒有 ledger，也**沒有** History 軌；正文以短 `##` 標題分面向。

---

## 4. 為何拆成 day／planner／writer，而不是一次 extract 寫完所有層

### 四件事要獨立 logic

1. Dream 處理 **day** chain（既有 extract + ledger/summary）
2. **Week** rollup
3. **Month** rollup
4. **Year** rollup

混在同一個巨大 extract prompt 會：

- 難測、難取消中間步驟；
- 補記舊日時，模型容易漏改高階；
- 無法保證 month 決策看到的是 **本輪剛寫的 week draft**。

### Planner vs Writer（禁止混責）

曾出現「analysis 決定改動內容 + rollup 又讓 AI 寫內容」的雙重生成，人審難對齊、成本加倍。

| 角色 | 只做 | 不做 |
|------|------|------|
| **Planner** | Y/N、影響哪些 id、短 reason | **禁止**產 summary 全文 |
| **Writer** | 對每個 id 讀下層 context，產 summary Current | 不自行擴大 id 集合（以 planner 為準；實作可對非法 id 校驗失敗） |

候選 id 多數可 **由本輪動到的 day_id 機械推導**（→ 覆蓋的 weeks → months → years）。Planner 主責是 **時機／是否值得滾**（未完月、無實質變更可 N），不是猜日期格式。

---

## 5. 為何用串聯（Option 2）而不是一次分析三層（Option 1）

```
Option 1: day → 一次 planner(週+月+年) → 再並行／順跑三層 writer
Option 2: day → week planner→writers → month planner→writers → year planner→writers
```

**在意的是：** Month 的叙事應能吸收 **本輪 week 的新 draft**；Year 同理看 month。

Option 1 在 week writer 跑完前就決定 month，讀到的仍是 **舊 live week**，與「先改 week 再改 month」矛盾。

代價：更多 agent round、dream 更慢。0.11 接受此代價；可用 mock agent 測管線。

跨月 ISO week：month writer 的讀取集是「與該月 **日期區間重疊** 的 weeks」，不是「week 檔所在 YYYY-MM 資料夾＝該月」。存放分組鍵 ≠ 讀取重疊集（見 store-layout）。

---

## 6. 為何 day 目錄分組與高階同版，但列為 Track 0

Flat `memory-chain/days/*.md` 在 `data-demo` 規模尚可，但長期會膨脹；高階已採 `YYYY-MM`／`YYYY` 分組，若 day 永遠 flat，路徑語言不統一，prompt 與遷移敘事醜。

**同版一次做完的理由：**

- 0.11 本來就要加多層 path helper；順手統一 day path，比高階上線後再遷 day **少一次** store 遷移。
- `data-demo` 反正要為週／月做 backfill，可順便搬 day 檔。

**列 Track 0（先做）的理由：**

- Day 是最熱讀寫路徑；先遷佈局、行為不變（API 仍用 `day_id`），通過 self-test 後再堆 rollup，失敗可 bisect。
- Day 分組 **零產品新功能**——若必須砍範圍，可砍 Track 0，但 **不建議**留下「flat day + nested 高階」長久並存。

**分版（另開 0.12 才遷 day）較不理想：** 兩次動同一 store、文件兩套佈局、rollup 讀 day 的 listing 之後還要再改。

---

## 7. 為何仍用 draft，不把「ENGRAM_HOME＝git」塞進 0.11

討論中有構想：store 做成 local git，apply 直接改 live，成功才 commit，失敗则 checkout——可簡化甚至取代 draft。

**認同延後（已進 backlog）：** 那是換寫入事務模型，與多層 chain 同版會失控。0.11 **維持** 現有 draft → pending_review → approve／discard。高階 summary 只是多寫進同一 dream draft。

見：[backlog/store-git-transactions.md](../../backlog/store-git-transactions.md)

---

## 8. 與虛擬時鐘／replay 的關係

關帳／「月是否結束」必須跟 **`ENGRAM_TZ` + `/clock`（虛擬時鐘）** 一致，否則 replay／`data-demo` 不會在模擬日邊界正確觸發 month／year。

Planner 的「今天／現在」與 day extract 相同來源（勿用壁鐘）。

驗收應含：對既有多月 day summary 做 **backfill**（或 replay 重跑後）能長出 week／month／year；補記舊日後再 dream，已 initialized 的 month 仍會 revise。

---

## 9. 一句話總覽（給急讀者）

> 高階 chain 是 **可再融合的 summary 層**；用 **initialized** 記「有沒有生過」，用 **planner Y/N** 記「這次該不該滾」；**串聯** week→month→year 以免上層看舊稿；**只要 summary**；day 分組當同版 Track 0；**繼續 draft**，git 事務另案。
