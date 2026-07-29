# 0.17.0 — 未來視雙區（hot／later）＋入夢前機械維護

← [changelog](../../../changelog.md) · 上游：[0.16.0](../0.16.0/INDEX.md) · current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> 來源：舊 backlog「mindzone／思考熱區」語意已併入本版（`hot`＝近窗工作集；**不**另開 mindzone 層）；[backlog/recall-future-sight.md](../backlog/recall-future-sight.md) **本版不做**（仍 backlog）  
> 本版改寫 0.4／0.14 起的 `future-sight/active/{id}.md` 一錨一檔模型；對齊 0.16 **draft 檔案管線**（未來視以整檔 `file_update` 維護，不是 typed `future` patch）。

## 產品句

> 未來視改成兩個整檔（近窗熱區 `hot.md`、較遠 `later.md`）；入夢前用純 script 依日曆過期清除並重分區後立刻 git commit；入夢 AI 再對兩檔做內容加減改，與其他記憶變更同一人審後 deploy——「惦記中的近未來」就是 hot，不是第二套記憶系統。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [CLAUDE.md](../../../CLAUDE.md) | 操作邊界；出貨時須同步 |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Track、驗收 |
| 2 | [docs/store-and-zones.md](./docs/store-and-zones.md) | 兩檔路徑、item 格式、排序、雙窗 config、分桶規則 |
| 3 | [docs/dream-maintenance.md](./docs/dream-maintenance.md) | 入夢前機械維護 commit；AI 內容維護；與 GET／approve 關係 |
| 4 | [docs/migrate-0.16-to-0.17.md](./docs/migrate-0.16-to-0.17.md) | `active/*.md` → `hot.md`／`later.md`；`store_version` |
| 5 | [docs/reasoning.md](./docs/reasoning.md) | 為何合一、為何兩檔、為何機械／AI 兩步、否決項 |
| 6 | [0.16 dream-file-pipeline](../0.16.0/docs/dream-file-pipeline.md) | 現行 draft／approve／git（本版未來視 path 改兩檔） |
| 7 | [0.4 store-and-patch](../0.4.0/docs/store-and-patch.md)／[expiry-and-api](../0.4.0/docs/expiry-and-api.md) | 舊一錨一檔＋過期語意（本版 supersede 存法；過期 event 精神保留） |

**讀完 1–5 即可開工**；無需依賴聊天紀錄。  
**不可開工條件：** 無（待拍板已清空）。

---

## 與 0.16 對照

| 題 | 0.16（及更早未來視） | 0.17 |
|----|---------------------|------|
| 存法 | `memories/future-sight/active/{id}.md` 一錨一檔 | **`hot.md`＋`later.md`** 兩整檔；廢 `active/` |
| 熱區／mindzone | 無；backlog 曾構想另層 | **同一未來視內分區**：`zone=hot\|later`；不另開 mindzone store |
| 時間窗 | 僅「未過期即 active」；無准入天數 | **`window_days`（預設 90）** 准入上限；**`hot_days`（預設 30）** 熱區 |
| 過期／重分區 | GET／approve 後懶掃過期硬刪單檔 | **入夢前 script**：過期刪＋重桶＋排序 → **立刻 git commit**；**GET 只過期清＋回傳，不重桶** |
| 內容更新 | 入夢 AI 可改未來視檔（draft） | **維持** AI 在 draft 改兩檔；入夢流程**必須**對照現有未來視做加減改（非可選） |
| 判斷日 | approve 擋 `anchor_end < today` | **一律以入夢日**（有效 clock／timezone）做准入、分桶、過期 |
| Config | 無未來視窗長 | `future_sight_*_days`；**workspace → 否則 env → 預設**（同 timezone 現碼；非 env 蓋 workspace） |
| Seek／search | 不注入未來視 | **本版仍不注入**（→ backlog） |

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 產品模型 | **一件事**：未來視。熱區＝近窗工作集（舊 backlog「mindzone」語意），**不是**獨立記憶層、不是日曆／待辦 |
| 2 | 磁碟 | `memories/future-sight/hot.md` 與 `memories/future-sight/later.md`；**廢** `active/`。空區仍可有檔（空 body／無 item 區塊）或等價「無 item」；ensure 建立目錄與兩檔骨架見 store-and-zones |
| 3 | 檔內格式 | 檔級 YAML frontmatter（`zone`）＋每個錨點 **`## {id}`＋yaml fence（僅起訖日）＋正文`**（INDEX #15；見 store-and-zones） |
| 4 | Item 排序 | 兩檔各自：**近→遠**。主鍵 `anchor_start` 升序 → `anchor_end` 升序 → `id` 升序。寫入後必須已排序；讀 API 同序 |
| 5 | 雙窗 config | `future_sight_window_days`（預設 **90**）、`future_sight_hot_days`（預設 **30**）。優先序與 **timezone／memory_language 現碼相同**：**workspace 鍵（若存在）→ 否則 env → 否則預設**。Env **不是**蓋過 workspace；僅在 workspace **未寫該鍵**時生效。Env 名：`ENGRAM_FUTURE_SIGHT_WINDOW_DAYS`、`ENGRAM_FUTURE_SIGHT_HOT_DAYS`。非法非正整數 → **拒啟**。**不強制** `hot_days < window_days`；later 常空可接受 |
| 6 | 判斷時刻 | **入夢日**（`calendarDate()`／有效虛擬 clock／有效 timezone）。Activities 不在寫入時做未來視准入；相對日在 extract 收成絕對日後，再套 window／hot |
| 7 | 分桶與過期 | 以日 `T`：**先** `anchor_end < T` → 過期刪（**`anchor_end === T` 仍活**，對齊 0.4「`today > anchor_end` 才過期」）。仍存活：`anchor_start ≤ T+hot_days` → **hot**；`T+hot_days < anchor_start ≤ T+window_days` → **later**；`anchor_start > T+window_days` → **出窗移出**。細節見 [store-and-zones.md](./docs/store-and-zones.md) |
| 8 | 超出 window 的新內容 | Extract **不得**寫入兩檔；太遠／含糊走 chain 或 node（維持 0.4 分流精神） |
| 9 | 入夢前機械維護 | `POST /dreams/run` **開始時、呼叫 agent 之前**：server **純 script**（**不**呼叫 AI）執行 full maintain（過期、出窗、重桶、排序）→ 若有變更則 **立刻 `git commit`**（message 前綴固定 `engram: future-sight maintain`）。然後再進入 draft extract |
| 10 | 機械 vs AI；approve 前整理 | **Script：** 過期、出窗、重桶、排序。**AI：** 內容 add／update／delete。AI 應按 `T`＋config 寫入正確檔，但 **`POST /dreams/approve` 在 deploy 之前對 draft 兩檔必跑一次 full maintain**（純 script，校正分桶／排序；若仍含 `anchor_end < today` → 409）。**Deploy 後不強制**再 maintain。見 [dream-maintenance.md](./docs/dream-maintenance.md) |
| 11 | 兩步 commit | **①** 入夢前維護 commit（無變更可跳過）。**②** approve deploy commit（含 AI 對兩檔的內容變更等）。過期／出窗清除 **不經** pending／approve |
| 12 | 刪除 event | 過期與出窗皆用 **`source: system/future_sight_expired`**；以 **`ingest_meta.reason`** 區分：`past_anchor_end`｜`out_of_window`。**cancelled／內容刪**：僅 AI draft＋approve，不走此 system source |
| 13 | GET `/memories/future-sight` | expire-only maintain → 若改了 tracked 檔則維護用 git commit → 回 `anchors[]`（每筆 **`zone`**；先 hot 再 later）。**不做**重桶 |
| 14 | 入夢 AI 義務 | Extract prompt **必須**對照兩檔做加減改（有實質更新才動）；與 nodes／chain 同一 report／approve |
| 15 | Item 檔案格式 | **鎖定**：檔級 frontmatter＋每個 item 為 `## {id}`＋**YAML code fence**（僅 `anchor_start`／`anchor_end`）＋正文。**不**存 node／event／dream provenance。見 store-and-zones。Migrate 須把舊「整檔 frontmatter＋正文」轉成此區塊形 |
| 16 | Draft／deploy | 未來視可部署 path **最多兩條**：`hot.md`、`later.md`。廢 `active/{id}.md` |
| 17 | Approve 閘門 | deploy 前 full maintain 後若仍有 `anchor_end < today` → **409** `stale_future_anchor`＋ids；pending 保留 |
| 18 | Status 計數 | **保留** `future_sight_active_count`＝兩檔 item **總數**；**另加** `future_sight_hot_count`、`future_sight_later_count` |
| 19 | Migration | `active/*.md` → 兩檔＋排序 → 刪 `active/`；`store_version` → `0.17.0`。見 [migrate-0.16-to-0.17.md](./docs/migrate-0.16-to-0.17.md) |
| 20 | 人審閘門 | **保留**；不入夢直寫 live 內容變更（機械維護除外） |
| 21 | Seek／Recall 注入 | **本版不做** |

---

## 非目標

- 獨立 mindzone 產品／另一個 store 目錄
- Recall／search／ask **注入**未來視（見 [backlog/recall-future-sight.md](../backlog/recall-future-sight.md)）
- 未來視當成日曆、待辦、提醒、過期 cron、遠端 sync
- `GET /memories/future-sight/expired` 或可 query 的過期庫
- 把 memory-chain 往未來日期延長
- 複雜 UI 看板（熱區拖曳、手動改 zone）；Consolidate report 能看出未來視變更即可；Memory 側可極薄
- 強制 `hot_days < window_days` 的啟動校驗
- 半套出貨（只改檔名仍一錨一檔、或只加 config 不改入夢前維護）

---

## 實作軌道（須全過；順序建議如下）

### Track 0 — 契約錨點

- **做：** 實作中若微調 frontmatter 鍵名／event `reason`／commit message 前綴，先改本版 `docs/*` 再改碼。
- **不做：** 發明第三檔或恢復 `active/{id}.md` 為主存法。
- **驗收：** 新 agent 只讀 1–5 能說出：兩檔路徑、雙窗預設、入夢前／AI／GET 各自做什麼、遷移結果。

### Track 1 — Config＋兩檔 store 讀寫

- **做：** 優先序 **workspace → 否則 env → 預設**（與 timezone 同算法）；parse／render **鎖定** yaml-fence item 形；list／sort；ensure 兩檔骨架；廢 `active/` 寫入主路徑。
- **不做：** 改 nodes／chain；另發明無 fence 格式。
- **驗收：** 寫入／讀回排序正確；workspace 鍵存在時 env 不蓋過；缺鍵用預設可啟動。

### Track 2 — 機械維護函式

- **做：** `maintainFutureSight`：`full`／`expire_only`，`live`／`draft`；event source＋reason 依 dream-maintenance；入夢開頭 full＋commit；GET expire-only＋commit。
- **不做：** 函式內呼叫 agent；GET 重桶。
- **驗收：** fixture 下過期消失、later→hot 僅在 full 後發生、GET 不改 zone；`reason` 可區分。

### Track 3 — 入夢 pipeline＋prompt＋approve

- **做：** run＝①維護 commit → ②extract；prompt 強制對照兩檔；**approve deploy 前對 draft 必跑 full maintain**；409 stale；status 三計數欄位。
- **不做：** Seek 注入；deploy 後強制再 maintain；恢復 typed `future` patch 主契約。
- **驗收：** activities→dream→approve 可增改錨點；discard 不回滾①；approve 前分錯區被 script 校正。

### Track 4 — Migration

- **做：** skill hop `migrate-0.16-to-0.17.md`（＋必要時腳本）；與 [docs/migrate-0.16-to-0.17.md](./docs/migrate-0.16-to-0.17.md) 一致；演練含至少一筆 `active/*.md` 的 0.16 store。
- **不做：** 重放歷史 dream；手改當正式 migrate。
- **驗收：** 升級後無 `active/`；兩檔可被 0.17 server 讀取；`store_version: 0.17.0`。

### Track 5 — 出貨

- **做：** `version.md`／`changelog.md`；api-docs／domain-language／CLAUDE／workbench；backlog mindzone 標已併入本版語意；INDEX → `shipped`。
- **驗收：** 總表全勾。

---

## 驗收總表

- [x] `hot.md`／`later.md` 為唯一未來視活集合；無 `active/` 寫入
- [x] Config：workspace → 否則 env → 預設；非法拒啟；不強制 hot&lt;window
- [x] 入夢前純 script full maintain＋有變更則 commit；不呼叫 AI
- [x] Approve deploy **前**對 draft 必跑 full maintain；deploy 後不強制
- [x] AI 入夢可維護兩檔；與人審／deploy 同路徑
- [x] GET：過期清＋`zone`；不重桶；有清除則維護 commit
- [x] 過期與出窗 event 同 source、reason 可區分
- [x] Item 僅 yaml-fence 形；migrate 完成格式轉換
- [x] Status：`future_sight_active_count`＋`_hot_count`＋`_later_count`
- [x] 排序近→遠；`anchor_end === T` 仍活；超出 window 不進未來視
- [x] migrate 0.16→0.17 可用；`store_version` 更新
- [x] `test:phases`（或等價）覆蓋未來視雙區＋維護
- [x] 文件與 version／changelog 已同步；INDEX＝`shipped`
- [x] Seek／ask **仍不**含未來視
---

## 錨點檔案（改前必讀）

| 路徑 | 角色 |
|------|------|
| `server/src/store/memories/future-sight.ts` | 現行 active 一檔一錨；本版重寫為兩檔 |
| `server/src/store/home.ts` | ensure 目錄 |
| `server/src/config.ts` | workspace 允許鍵（現僅 timezone／memory_language／store_version） |
| `server/src/dream/run.ts` | 入夢編排；插入維護步驟；approve sweep |
| `server/src/store/dreams/draft.ts` | draft 未來視 path（若仍有 active 假設須改） |
| `server/prompts/`（dream／extract 相關） | 強制對照未來視 |
| `server/src/api/future-sight.ts` | GET 契約 |
| `server/src/cli/self-test.ts` | Phase 未來視案例 |
| `docs/api-docs/api.md`、`docs/domain-language.md` | 出貨同步 |
| `.claude/skills/engram-migration/SKILL.md` | 加 0.16→0.17 hop |
| `.claude/skills/engram-workbench/SKILL.md` | 操作語意 |

---

## 開工前仍須拍板

（無。）
