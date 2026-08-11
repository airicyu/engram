# Engram 產品領域詞彙（Domain Language）

本檔整理 Engram 專案裡反覆出現的**產品／領域術語**，供人類閱讀與對照 AI 產出時使用。  
**不是** UI 翻譯檔（i18n）；程式識別子與 API 欄位名以原文為準。

閱讀方式：表格欄位為 **EN**（英文／代號）、**中文**、**說明**；必要時附 API、檔案路徑或備註。

**用語原則：** 產品面寫入動作用 **Activities**（`POST /activities`），不另列 Ingest／Capture 為場景名。

---

## 記憶庫（memory store）

**唯一領域名：** 中文 **記憶庫**；英文 **memory store**。  
整份磁碟上的個人記憶根目錄（底下有 `memories/`、`dreams/`、`tmp/` 等）——文件、對話、roadmap **只許用這個詞**，不要另造 data home／workspace／ENGRAM_STORE_DIR 當同義別名。

| 可以寫 | 不可以寫成「記憶庫的另一個名字」 |
|--------|----------------------------------|
| 記憶庫／memory store | data home、data workspace、engram home（當產品詞） |
| 「用環境變數 `ENGRAM_STORE_DIR` **指向**記憶庫路徑」 | 「ENGRAM_STORE_DIR＝記憶庫」「memory store／ENGRAM_STORE_DIR」並稱 |

**相鄰但不同：**

| 詞 | 指什麼 |
|----|--------|
| `ENGRAM_STORE_DIR` | **僅** env／設定鍵：其值＝記憶庫的絕對路徑（如 `/status.store_dir`） |
| **workspace config**（`engram.workspace.yaml`） | 記憶庫**內**的偏好檔（timezone、`memory_language`） |
| setup 表單「Data home」 | 安裝 UI 選路徑的臨時標籤；寫進領域文件時改稱「選定記憶庫路徑」 |
| `data/`、`engram-data/` 等 | 常見路徑實例，不是術語 |

---

## 產品循環（你在 UI 上做的事）

| EN | 中文 | 說明 | API／動作 | 備註 |
|----|------|------|-----------|------|
| **Activities** | 事件 | 把「此刻要記住的事」寫進系統（L0 + short-term memory） | `POST /activities` | UI 場景 id：`activities`；UI 中文 tab＝**事件**；body 用 **`raw`** |
| **Consolidate** | 沉澱 | 整理短時記憶：AI 出報告，人審後寫入長期 | `POST /dreams/run` → Approve／Discard | 核心是人審關卡 |
| **Clarify** | 釐清 | 系統補問人＋人順帶補充；入夢蒸餾進 draft nodes，approve 才進 L2 | `/memories/clarify/*` | 非 activity；場景 id：`clarify`（0.30） |
| **Seek** | 尋找 | 用關鍵字或 AI 提問找記憶 | `GET /memories/search`、`POST /memories/ask` | 0.8.0 自 Memory 場景拆出 |
| **Memory** | 記憶 | 沿時間軸或節點列表翻閱已寫入記憶 | `GET /memories/chain`、`GET /memories/nodes` | 0.8.0 browse；不含 Search／Ask |
| **Dream** | 入夢 | 對 short-term memory 跑 AI 提取，產出待審報告 | `POST /dreams/run` | 產品語；技術上含 extract |

### Seek（0.8.0）

| EN | 中文 | 說明 | API | 備註 |
|----|------|------|-----|------|
| **Search** | 搜尋 | keyword 命中 short-term／chain／nodes／**future-sight** | `GET /memories/search?q=&scope=` | `q` 必填；`scope` 可選（`l1,nodes,chain,future`；預設四者）；`future`＝掃 hot＋later |
| **Ask** | 提問 | AI 讀 store、自然語言問答（非同步 job） | `POST /memories/ask`、`GET /memories/ask/{job_id}` | 同時只允許一個 running job；可選 `include_later`（預設 false＝可讀 hot、不可讀 later） |

### Memory browse（0.8.0）

| EN | 中文 | 說明 | API | 備註 |
|----|------|------|-----|------|
| **Day／week／month／year chain browse** | 記憶鏈翻閱 | 各層 index（新→舊）+ detail | `GET /memories/chain`、`/weeks`、`/months`、`/years`（及 `/{id}`） | 0.11.0 四層；與 Search 分工 |
| **Nodes browse** | 節點翻閱 | L2 index（字母序）+ `{id}.md` 正文 detail | `GET /memories/nodes`、`GET /memories/nodes/{node_id}` | filter 在客戶端 |
| **Short-term preview** | 短期記憶預覽 | Activities 場景顯示短期 pool 摘要 | `GET /memories/short-term-memory` | 僅 short-term；不在 Memory 場景瀏覽 |

### Time replay（0.9.0）

| EN | 中文 | 說明 | API／工具 | 備註 |
|----|------|------|-----------|------|
| **Virtual clock** | 虛擬時鐘 | 記憶時間線的「現在」；capture／dream／agent 共用 | `GET`/`PUT`/`DELETE /clock` | `PUT` 需 `ENGRAM_ALLOW_VIRTUAL_CLOCK=1` |
| **Time replay** | 時間重播 | 按日重播 fixture：記下 → 入夢 → approve | `bun run replay` | 獨立 `ENGRAM_STORE_DIR`；勿污染真人 store |
| **Fixture event** | 重播事件 | mock 的 encoding `ts` + `raw` | JSONL | 不直接寫入 store；經 capture API |

---

## 記憶層（資料存在哪一層）

層級／名稱反映**資料在管線中的位置**，不是檔案目錄名：

| 層 | 定位 |
|----|------|
| **L0**（activities） | 事件（發生了什麼） |
| **short-term memory** | 短期記憶（尚未沉澱的輸入） |
| **dream staging** | **short-term → L2 的中間態**（入夢提案 + 待審 draft） |
| **L2** | **長期已沉澱記憶**＝**nodes**（主題軸）＋**chain**（時間軸） |

> 舊稱把 **L2** 窄指 nodes、chain 另列平級；自本文件起 **L2 = nodes + chain**（兩種長期表面）。HTTP search `scope` 仍分 `nodes`／`chain`（wire 凍結）。程式裡歷史欄位如 extract context `l2_current`＝**L2 的 nodes 面**，不是「整個 L2」。  
> 舊稱 **L1**／**L1.5**（至 0.14）→ **short-term memory**／**dream staging**。HTTP wire 名（如 `scope=l1`、`l1_empty`）仍凍結，見 api-docs。

| EN | 中文 | 說明 | 典型路徑 | 可變性 |
|----|------|------|----------|--------|
| **L0** | 事件層 | 發生了什麼（原文、時間、來源） | `memories/activities/events.jsonl` | 唯附加 |
| **short-term memory** | 短期記憶層 | 尚未整理進長期的工作區 pool | `memories/short-term-memory/pool.jsonl` | Activities 寫入；Approve 後清 scope S |
| **dream staging** | 入夢中間層 | 由 short-term 入夢產出、待 Approve 才進 L2（draft＋report） | `dreams/draft/`、`dreams/reports/` | `dreams/` 不進 store git |
| **L2 · nodes** | 長期節點理解 | 對某主題／人目前「相信什麼」＝**standing understanding**（整檔 `{id}.md`） | `memories/nodes/{id}/{id}.md` | Approve 寫入；可手改。Obsidian 開 **`memories/`** |
| **L2 · chain** | 長期記憶鏈／時間軸 | 公共時間軸（世界發生了什麼） | `memories/chain/days|weeks|months|years/` | 0.11.0 起含週／月／年 **summary**；day 仍雙軌 ledger／summary |
| **future-sight** | 近程前瞻 | 短期要盯的錨點（deadline 等）；hot＝近窗熱區 | `memories/future-sight/hot.md`＋`later.md` | 入夢前／GET 機械過期；內容經入夢＋人審 |

**一句話對照：**

| 你想問… | EN | 中文 |
|---------|-----|------|
| 當時 raw 寫了什麼 | L0 | 事件層 |
| 還沒入夢／還沒批准的輸入 | short-term memory | 短期記憶 |
| AI 那次提案了什麼、draft 長怎樣 | dream staging | 入夢中間層 |
| 已沉澱的長期記憶（整體） | **L2** | 長期記憶（nodes＋chain） |
| 現在對某主題的穩定理解 | L2 · nodes | 長期節點理解 |
| 那天／那週整體發生什麼 | L2 · chain | 記憶鏈摘要 |
| 那天寫入了哪些 patch block | chain ledger (day) | 日鏈增量紀錄（0.5.0） |
| 這週／這前要盯什麼 | future-sight | 近程前瞻 |

---

## Dream 流程（0.16+ 現行）

```
activities → dreams/run → pending_review → approve | discard | retry
              ↑                              ↓
         AI 改 draft 檔 + report     deploy → L2 + git commit
         (不寫 live L2)               then clear short-term scope S
```

| EN | 中文 | 說明 | 備註 |
|----|------|------|------|
| **dream (file pipeline)** | 入夢（檔案管線） | AI 在 `dreams/draft/{run_id}/` 改檔並寫協定 report | 0.16 主路徑；廢 typed Patch[] 驅動 |
| **file_update** | 檔案覆寫 | 整檔寫入 summary／what／future-sight 等 | 無 `## Current`／`## History` |
| **file_append** | 檔案附加 | 僅 day ledger；sidecar 或程式級 append | 保留 patch metadata |
| **deploy** | 部署 | approve：deletes → draft→live copy | 失敗只還原 touched paths |
| **store git** | 記憶庫 git | approve 後 `git commit`（含 `dream_run_id`） | local only；不追 `dreams/`／`tmp/` |
| **pending** / **pending_review** | 待審 | 有一份待審入夢結果（系統內唯一） | `GET /dreams/pending`（report＋`draft_summary`） |
| **scope S** | 範圍 S | 本次入夢凍結的 L0 event id 集合 | Approve 後只清 S；可跨日 |
| **lock** / **dream lock** | 入夢鎖 | 入夢／deploy 期間互斥 | 鎖住時 Activities／Clarify → 409；pending 可寫 activities／clarify |
| **dream_run_id** | 入夢執行 ID | 一次入夢的唯一識別碼 | Approve／Discard 可選帶入 |
| **report** | 報告 | 固定結構 narrative＋Appendix 路徑 | pending 介面閱讀 |
| **draft** | 草稿工作樹 | approve 前的暫存目錄 | `dreams/draft/{id}/` |
| **draft_summary** | 草稿摘要 | entry 數、chain／future 路徑摘要 | `GET /dreams/pending` |

---

## 檔案變更（Dream 產出；0.16）

入夢不再以 typed JSON **patch union** 為主契約；intent＝draft 裡改了哪些檔。歷史用語「patch metadata」仍可出現在 **day ledger** 的 `<!-- patch:… -->` block。

| 產物 | 說明 | 寫入目標 |
|------|------|----------|
| 新建／更新 node | **Standing understanding**（四段骨架） | `memories/nodes/{id}/{id}.md`（整檔；見下行） |
| day ledger block | 日鏈增量稽核 | `memories/chain/days/{YYYY-MM}/{id}.md`（append-only） |
| day／week／month／year summary | 可讀敘事 snapshot | 對應 `*.summary.md`（整檔） |
| future-sight | 近程錨點 | `future-sight/hot.md`／`later.md` |
| deletes | 白名單刪除清單 | draft `deletes.txt` → deploy 先刪 |

**Approve 閘門錯誤：**

| EN (error) | 中文 | 說明 |
|------------|------|------|
| `future_chain_id` | 未來日鏈 ID | draft 中的 day id 不能是未來日 |
| `stale_future_anchor` | 過期前瞻錨點 | `anchor_end` 已過，拒絕寫入 |
| `empty_patches` | 無檔案變更 | 無 L2 寫入（wire 欄位名沿用），但仍清 scope S |

---

## Node（L2 主題軸的錨點）

| EN | 中文 | 說明 |
|----|------|------|
| **node** | 節點 | L2 主題軸實體：人、組織、專案、主題等 |
| **node_refs** | 節點參照 | Activities 可選標註「跟哪些 node 有關」 |
| **`{id}.md`**／**standing understanding** | 長期理解檔 | 該 node **現在是什麼** 的可維護模型；固定四段 `## Identity` → `## Relation` → `## Standing facts` → `## Current situation`（空段 `_None_`）。提及其他 L2 node 時 Relation 用 wikilink `[[nodes/{id}/{id}|{id}]]`（vault＝`memories/`）。**事件流水在 chain**，不在此檔主幹；chain 敘事亦可含同形 P1（0.31，寫入時存在才 link）。整檔＝最新理解；無 `## Current`／`## History` |
| **understanding** | API 欄位 | `GET`／search／dream `l2_current` 回傳的 **整檔** `{id}.md` 字串（standing understanding）；**不是**「僅 Current situation 段」。0.26 起取代舊鍵 `what_current` |
| **Structure notes** | Dream report 節 | Finalize 後軟校驗警告（缺小標／疑似無 link／死連）；無問題＝`_None_`；**不**擋 approve |
| **facet** | 理解面向 | 舊設計 who／why／open 等多檔；現行 file pipeline **只**寫 what；多 facet **未**接線 |
| **match_reason** | 命中原因 | search 時為何選中該 node |
| **score**（帳面） | 活躍分 | 有結算的 dream 才增減；存 `score.yaml`；**非**未來視 hot |
| **display_score** | 相對活躍分 | `ceil(score/max_score*100)`（1–100）；無 max → null／— |
| **category** | 涉入档 | `mention`｜`update`｜`focus`；AI 只判档，script 算分 |
| **node_score_involvements** | 涉入列表 | pending 時 artifact／API；2a 可改 category |

---

## 狀態與健康指標

### `dream_status`（`GET /status`）

| EN (value) | 中文 | 說明 |
|------------|------|------|
| `never_dreamed` | 從未入夢 | 從未成功跑完 extract |
| `pending_review` | 待審 | 有待審入夢結果 |
| `l1_clear_pending` | short-term 清理待重試（wire 名凍結） | L2 已 commit，清 short-term 失敗 |
| `dream_incomplete` | 入夢未完成 | 入夢／finalize 失敗；short-term 保留 |
| `ok` | 正常 | 穩態 |

### 其他常見欄位

| EN | 中文 | 說明 |
|----|------|------|
| **l1_empty** | short-term 是否為空（wire 名凍結） | pool 無條目時為 true |
| **dream_job** | 入夢非同步工作 | `running`／`completed`／`failed` |
| **search packet** | 搜尋包 | `GET /memories/search` 回傳：僅 keyword 命中的 `l1`／`chain[]`／`nodes`／`future_sight[]`（當 scope 含對應 token） |
| **ENGRAM_STORE_DIR** | （env 鍵名） | 設定「記憶庫絕對路徑」的環境變數；**不是**記憶庫的領域別名 |

---

## Future-sight（0.4）

| EN | 中文 | 說明 |
|----|------|------|
| **anchor** | 錨點 | 一則近程要留意的事 |
| **anchor_start** / **anchor_end** | 錨點起訖日 | 有效區間（設定時區日級；預設 Asia/Hong_Kong） |
| **zone** | 分區 | `hot`（近窗熱區）／`later`（仍在 window 內） |
| **sweep** / **lazy sweep** | 懶清掃 | GET 時過期清（不重桶）；入夢前 full maintain |
| **swept_expired** | 本次清掉清單 | 剛移除的過期 anchor id |

過期／出窗：寫 L0 + short-term system event（`source: system/future_sight_expired`，`reason` 區分），再從兩檔移除。無過期瀏覽 API。  
Seek（0.18+）：Search scope `future` 掃兩區；Ask 預設可讀 `hot.md`，`include_later:true` 才讀 `later.md`。准入窗預設 **365** 日（workspace／env 可覆寫）。

---

## Memory-chain 雙軌（0.5.0 規劃）

同一 occurrence day 兩份檔案並存：

| EN | 中文 | 說明 | 路徑 | 寫入 |
|----|------|------|------|------|
| **chain ledger** | 日鏈增量紀錄 | patch block 稽核鏈；append-only | `memories/chain/days/{YYYY-MM}/{id}.md` | 機械 append |
| **chain summary** | 日鏈融合摘要 | 可讀的當日敘事；search 命中時回傳 | `memories/chain/days/{YYYY-MM}/{id}.summary.md` | extract 產出 `summary`；approve 機械 revise |

- 一筆 `chain` patch 同時寫 ledger block 與 summary（`summary_operation`: `init` \| `revise`）。
- 既有 `days/*.md` 視為 ledger；summary 由下一輪 dream 產生。
- **0.31：** 寫入 day／week／month／year 敘事時，若提及**當時已存在**（live 或本輪新建）的 L2 node，機器寫入 P1 `[[nodes/{id}/{id}|{id}]]`。之後才建立的 node **不**回頭改舊 chain（無歷史 backfill）。Workbench `MdBlock` 將此類 wikilink 渲成 `#/memory/nodes/{id}` 可點連結。

---

## Workbench（工作台）

### Hash 深鏈（0.31.0）

| 英文 | 中文 | 說明 |
|------|------|------|
| **Hash route** | **Hash 深鏈** | `location.hash` 書籤／分享場景與 Memory 選中項（`#/clarify`、`#/memory/nodes/{id}` 等） |
| **Lazy hash write** | **懶寫 hash** | 空 hash 顯示 activities，進站不自動改成 `#/activities` |
| **Push vs replace** | **推進／取代歷史** | 場景 tab → push；Memory 同 mode 換選中項 → replace |

### Clarify（0.30.0）

| 英文 | 中文 | 說明 |
|------|------|------|
| **Follow-up / prompt** | **補問** | 系統產生、等人回答的問題（`asking/`） |
| **Aside** | **順帶補充** | 人自發寫入 pending（`kind: aside`）；不進 L0／ledger |
| **Distill** | **蒸餾** | 入夢末段把 pending 折進 draft node 主檔 |
| **Generate** | **生成補問** | 入夢末段 server 寫入新的 asking |

個人記憶**工作台**——走 Activities → Consolidate → Clarify → Seek → Memory；**不是** admin dashboard、不是多使用者後台。

| EN | 中文 | 說明 | 路徑／備註 |
|----|------|------|------------|
| **workbench** | 工作台 | 產品操作面總稱（人 + agent 透過 API 操作記憶） | 舊稱 **operator**（0.5.0 前） |
| **workbench UI** | 工作台介面 | 瀏覽器五場景 UI | `web/`（`:8788`） |
| **engram-workbench** | 工作台 skill | Agent 用 HTTP 打 API；禁止手改記憶庫 | `.claude/skills/engram-workbench/` |
| **status light** | 狀態燈 | 頂欄連線／入夢狀態指示 | workbench UI |
| **scene** | 場景 | Activities／Consolidate／Clarify／Seek／Memory 五主畫面（id：`activities`…） | workbench UI |

**Workbench UI i18n（0.5.0）：** 僅介面殼層；**English** + **繁體中文**；不翻譯 short-term／L2／chain／report 等記憶內容。

---

## 演進與易混淆舊詞

| EN 舊／別名 | EN 現行 | 中文說明 |
|-------------|---------|----------|
| **data home**（setup UI） | —（廢棄當領域別名） | 改說「選定記憶庫路徑」 |
| **workspace**（指整個資料夾） | **記憶庫** | 偏好檔另稱 **workspace config** |
| **ENGRAM_STORE_DIR**（當產品名） | **記憶庫** | 僅保留為 env 鍵 |
| **Ingest**／**Capture**（舊場景名） | **Activities** | 寫入 API／用語統一（`/ingest` → `/capture` → `/activities`；UI 場景 id：`activities`） |
| **L0.5** | **L1.5** → **dream staging**（0.15） | 層級命名：中間態在 short-term 與 L2 之間 |
| **Activate** | **Recall** → **Memory** | 0.4 Activate→Recall；0.7.0 Recall→Memory（場景／讀取域） |
| **Recall** | **Seek** + **Memory** | 0.7.0 `GET /recall` → search；0.8.0 UI 拆 **尋找**（search+ask）與 **記憶**（browse） |
| **Extract**（UI） | **Dream**（入夢） | Consolidate 主按鈕改名 |
| **auto-apply** | **pending + approve** | 不再 extract 後直接寫 L2 |
| **apply**（舊） | **deploy + git commit** | 0.16：draft 部署進 live 再 commit；更早曾稱 materialize＋commit |
| **candidates**（建 node） | **propose_node on approve** | 建 node 改在 approve 時 |
| **operator** / **operator UI** | **workbench** | 工作台與 `engram-workbench` skill（0.5.0） |

---

## 快速對照：檔案 ↔ 概念

| Path | EN | 中文 |
|------|-----|------|
| `memories/activities/events.jsonl` | L0 event log | 事件層 |
| `memories/short-term-memory/pool.jsonl` | short-term mem pool | 短期 pool |
| `dreams/patches.jsonl` | （考古）舊 patch log | 0.16 不再作為入夢驅動；可留檔 |
| `dreams/draft/{run_id}/` | pending draft | 待審草稿 |
| `dreams/reports/{run_id}.md` | human report | 人類可讀報告 |
| `memories/nodes/{id}/{id}.md` | L2 semantic understanding | L2 語意理解 |
| `memories/chain/days/{YYYY-MM}/*.md` | chain ledger (day) | 日鏈增量紀錄（0.5.0 語義；0.11.0 起按月分組） |
| `memories/chain/days/{YYYY-MM}/*.summary.md` | chain summary (day) | 日鏈融合摘要（0.5.0；0.11.0 起按月分組） |
| `memories/future-sight/hot.md`／`later.md` | future-sight zones | 近程前瞻雙區 |
| `web/` | workbench UI | 工作台介面 |
| `.claude/skills/engram-workbench/` | engram-workbench skill | 工作台 HTTP skill |

---

## 延伸閱讀

| 檔案 | 內容 |
|------|------|
| [README.md](../README.md) | 產品是什麼、如何啟動 |
| [api-docs/api.md](./api-docs/api.md) | HTTP API 契約 |
| [AGENTS.md](../AGENTS.md) | 給 coding agent 的專案脈絡 |
| [roadmap/0.1.0/INDEX.md](./roadmap/0.1.0/INDEX.md) | MVP 分層與設計決策 |
| [changelog.md](../changelog.md) | 版本演進 |
