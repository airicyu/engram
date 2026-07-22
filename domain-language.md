# Engram 產品領域詞彙（Domain Language）

本檔整理 Engram 專案裡反覆出現的**產品／領域術語**，供人類閱讀與對照 AI 產出時使用。  
**不是** UI 翻譯檔（i18n）；程式識別子與 API 欄位名以原文為準。

閱讀方式：表格欄位為 **EN**（英文／代號）、**中文**、**說明**；必要時附 API、檔案路徑或備註。

**用語原則：** 產品面只講 **Capture**（`POST /capture`），不另列 Ingest。

---

## 產品循環（你在 UI 上做的事）

| EN | 中文 | 說明 | API／動作 | 備註 |
|----|------|------|-----------|------|
| **Capture** | 記下 | 把「此刻要記住的事」寫進系統（L0 + L1） | `POST /capture` | UI 場景名、按鈕語；body 用 **`raw`** |
| **Consolidate** | 沉澱 | 整理短時記憶：AI 出報告，人審後寫入長期 | `POST /dream/run` → Approve／Discard | 核心是人審關卡 |
| **Recall** | 回憶 | 用關鍵字拉回相關記憶包 | `GET /recall?q=` | 0.4 取代 **Activate** |
| **Dream** | 入夢 | 對 L1 跑 AI 提取，產出待審報告 | `POST /dream/run` | 產品語；技術上含 extract |

---

## 記憶層（資料存在哪一層）

層級編號反映**資料在管線中的位置**，不是檔案目錄名：

| 層 | 定位 |
|----|------|
| **L0** | 事件（發生了什麼） |
| **L1** | 短期記憶（尚未沉澱的輸入） |
| **L1.5** | **L1 → L2 的中間態**（入夢提案 + 待審 draft） |
| **L2** | 長期理解（已 commit 的語意表面） |

> 舊稱 **L0.5**（0.4.1 前）；現稱 **L1.5**（語意上夾在 L1 與 L2 之間，不是 L0 的延伸）。

| EN | 中文 | 說明 | 典型路徑 | 可變性 |
|----|------|------|----------|--------|
| **L0** | 事件層 | 發生了什麼（原文、時間、來源） | `log/events.jsonl` | 唯附加 |
| **L1** | 短期記憶層 | 尚未整理進長期的工作區 pool | `short-term-memory/pool.jsonl` | Capture 寫入；Approve 後清 scope S |
| **L1.5** | 入夢中間層 | 由 L1 入夢產出、待 Approve 才進 L2（patch + 報告 + draft） | `dream/patches.jsonl`、`dream/draft/` | patch log 唯附加 |
| **L2** | 長期理解層 | 對 node 目前「相信什麼」 | `nodes/{id}/understand/what.md` | Approve 寫入；可手改 |
| **chain** | 記憶鏈／時間軸 | 日級公共時間軸（世界發生了什麼） | `memory-chain/days/` | MVP 僅 day 級；0.5.0 起拆 **ledger**／**summary**（見下） |
| **future-sight** | 近程前瞻 | 短期要盯的錨點（deadline 等） | `future-sight/active/` | 過期寫 event 後硬刪 |

**一句話對照：**

| 你想問… | EN | 中文 |
|---------|-----|------|
| 當時 raw 寫了什麼 | L0 | 事件層 |
| 還沒入夢／還沒批准的輸入 | L1 | 短期記憶 |
| AI 那次提案了什麼、draft 長怎樣 | L1.5 | 入夢中間層 |
| 現在對某主題的穩定理解 | L2 | 長期理解 |
| 那天整體發生什麼（可讀摘要） | chain summary (day) | 日鏈融合摘要（0.5.0） |
| 那天寫入了哪些 patch block | chain ledger (day) | 日鏈增量紀錄（0.5.0） |
| 這週／這前要盯什麼 | future-sight | 近程前瞻 |

---

## Dream 流程（0.3+ 現行）

```
capture → dream/run → pending_review → approve | discard
              ↑                              ↓
         extract + materialize        commit → L2 / chain / future-sight
         (no L2 write)                 then clear L1 scope S
```

| EN | 中文 | 說明 | 備註 |
|----|------|------|------|
| **extract** | 提取 | 讀 L0／L1／L2，LLM 產出 patches + report | 技術動詞；UI 常稱入夢 |
| **materialize** | 具現化／投影 | 把 patches 寫成 draft 檔（尚未 commit） | 舊版直接 apply 到 L2 已廢 |
| **commit** / **commitDraft** | 提交／正式寫入 | approve 時把 draft 寫入 live store | 失敗則 L2 不變 |
| **pending** / **pending_review** | 待審 | 有一份待審入夢結果（系統內唯一） | `GET /dream/pending` |
| **scope S** | 範圍 S | 本次入夢凍結的 L0 event id 集合 | Approve 後只清 S；可跨日 |
| **supersede** | 取代 | 再 `dream/run` 時丟舊 pending，對目前 L1 重跑 | 非 merge 兩份報告 |
| **lock** / **dream lock** | 入夢鎖 | extract／commit 期間互斥 | 鎖住時 Capture → 409 |
| **dream_run_id** | 入夢執行 ID | 一次入夢的唯一識別碼 | Approve／Discard 可選帶入 |
| **report** | 報告 | 給人看的 Markdown 摘要 | pending 介面閱讀 |
| **draft** | 草稿投影 | approve 前的暫存目錄 | `dream/draft/{id}/` |
| **draft_summary** | 草稿摘要 | API 回傳的 entry 數、chain 天數等 | `GET /dream/pending` |

---

## Patch（Dream 的結構化提案）

Dream extract 產出多筆 **patch**；每筆描述 approve 後要對 store 做哪類寫入。

| EN (type) | 中文 | 說明 | 寫入目標 |
|-----------|------|------|----------|
| **propose_node** | 提議新建節點 | 建議新建 node（人／組織／主題） | `nodes/{id}/` |
| **semantic** (`facet: what`) | 語意更新 | 更新 node「是什麼」 | `understand/what.md` |
| **chain** (`level: day`) | 日鏈 | 某**發生日**的全局紀錄 | `memory-chain/days/{id}.md`（ledger）；`…/{id}.summary.md`（summary，0.5.0） |
| **future** | 前瞻錨點 | 近程要留意的事 | `future-sight/active/{id}.md` |
| **episodic** | 情節歸因 | 低信心候選；高信心原型 no-op | attribution 候選 |

**Approve 閘門錯誤：**

| EN (error) | 中文 | 說明 |
|------------|------|------|
| `future_chain_id` | 未來日鏈 ID | chain 日期 id 不能是未來日 |
| `stale_future_anchor` | 過期前瞻錨點 | `anchor_end` 已過，拒絕寫入 |
| `empty_patches` | 空 patch 集 | 無 L2 寫入，但仍清 scope S |

---

## Node（長期記憶的錨點）

| EN | 中文 | 說明 |
|----|------|------|
| **node** | 節點 | 記憶圖實體：人、組織、專案、主題等 |
| **node_refs** | 節點參照 | Capture 可選標註「跟哪些 node 有關」 |
| **what.md** | 是什麼（facet） | 該 node 當前定義與邊界；MVP 主 facet |
| **facet** | 理解面向 | what／who／why 等；多數尚未實作 |
| **match_reason** | 命中原因 | recall 時為何選中該 node |

---

## 狀態與健康指標

### `dream_status`（`GET /status`）

| EN (value) | 中文 | 說明 |
|------------|------|------|
| `never_dreamed` | 從未入夢 | 從未成功跑完 extract |
| `pending_review` | 待審 | 有待審入夢結果 |
| `l1_clear_pending` | L1 清理待重試 | L2 已 commit，清 L1 失敗 |
| `dream_incomplete` | 入夢未完成 | extract／materialize 失敗；L1 保留 |
| `dead_letter_pending` | 死信佇列待處理 | legacy DLQ 非空 |
| `ok` | 正常 | 穩態 |

### 其他常見欄位

| EN | 中文 | 說明 |
|----|------|------|
| **DLQ** (dead-letter queue) | 死信佇列 | 舊版 apply 失敗的 patch 佇列 |
| **l1_empty** | L1 是否為空 | pool 無條目時為 true |
| **dream_job** | 入夢非同步工作 | `running`／`completed`／`failed` |
| **context packet** | 上下文包 | recall 回傳：L1 + chain + nodes |
| **ENGRAM_HOME** | 記憶庫根目錄 | 預設 `data/`；執行期 store |

---

## Future-sight（0.4）

| EN | 中文 | 說明 |
|----|------|------|
| **anchor** | 錨點 | 一則近程要留意的事 |
| **anchor_start** / **anchor_end** | 錨點起訖日 | 有效區間（設定時區日級；預設 Asia/Hong_Kong） |
| **sweep** / **lazy sweep** | 懶清掃 | 讀 API 時順便清過期錨點 |
| **swept_expired** | 本次清掉清單 | 剛移除的過期 anchor id |

過期：寫 L0+L1 system event（`future_sight_expired`），再刪 active 檔。無過期瀏覽 API。

---

## Memory-chain 雙軌（0.5.0 規劃）

同一 occurrence day 兩份檔案並存：

| EN | 中文 | 說明 | 路徑 | 寫入 |
|----|------|------|------|------|
| **chain ledger** | 日鏈增量紀錄 | patch block 稽核鏈；append-only | `memory-chain/days/{id}.md` | 機械 append |
| **chain summary** | 日鏈融合摘要 | 可讀的當日敘事；Recall 預設讀此 | `memory-chain/days/{id}.summary.md` | extract 產出 `summary`；approve 機械 revise |

- 一筆 `chain` patch 同時寫 ledger block 與 summary（`summary_operation`: `init` \| `revise`）。
- 既有 `days/*.md` 視為 ledger；summary 由下一輪 dream 產生。

---

## Workbench（工作台）

個人記憶**工作台**——走 Capture → Consolidate → Recall；**不是** admin dashboard、不是多使用者後台。

| EN | 中文 | 說明 | 路徑／備註 |
|----|------|------|------------|
| **workbench** | 工作台 | 產品操作面總稱（人 + agent 透過 API 操作記憶） | 舊稱 **operator**（0.5.0 前） |
| **workbench UI** | 工作台介面 | 瀏覽器三場景 UI | `web/`（`:8788`） |
| **engram-workbench** | 工作台 skill | Agent 用 HTTP 打 API；禁止手改 `ENGRAM_HOME` | `.claude/skills/engram-workbench/` |
| **status light** | 狀態燈 | 頂欄連線／入夢狀態指示 | workbench UI |
| **scene** | 場景 | Capture／Consolidate／Recall 三主畫面 | workbench UI |

**Workbench UI i18n（0.5.0）：** 僅介面殼層；**English** + **繁體中文**；不翻譯 L1／L2／chain／report 等記憶內容。

---

## 演進與易混淆舊詞

| EN 舊／別名 | EN 現行 | 中文說明 |
|-------------|---------|----------|
| **Ingest** | **Capture** | 寫入 API／用語統一（0.4.1：`/ingest` → `/capture` 硬切） |
| **L0.5** | **L1.5** | 層級命名修正：中間態在 L1 與 L2 之間，非 L0 延伸 |
| **Activate** | **Recall** | 回憶 API 改名（0.4；中文不用「召回」） |
| **Extract**（UI） | **Dream**（入夢） | Consolidate 主按鈕改名 |
| **auto-apply** | **pending + approve** | 不再 extract 後直接寫 L2 |
| **apply**（舊） | **materialize + commit** | 拆成 draft 投影與人審 commit |
| **candidates**（建 node） | **propose_node on approve** | 建 node 改在 approve 時 |
| **operator** / **operator UI** | **workbench** | 工作台與 `engram-workbench` skill（0.5.0） |

---

## 快速對照：檔案 ↔ 概念

| Path | EN | 中文 |
|------|-----|------|
| `log/events.jsonl` | L0 event log | 事件層 |
| `short-term-memory/pool.jsonl` | L1 mem pool | 短期 pool |
| `dream/patches.jsonl` | L1.5 patch log | 入夢 patch 紀錄 |
| `dream/draft/{run_id}/` | pending draft | 待審草稿 |
| `dream/reports/{run_id}.md` | human report | 人類可讀報告 |
| `nodes/{id}/understand/what.md` | L2 semantic understanding | L2 語意理解 |
| `memory-chain/days/*.md` | chain ledger (day) | 日鏈增量紀錄（0.5.0 語義） |
| `memory-chain/days/*.summary.md` | chain summary (day) | 日鏈融合摘要（0.5.0） |
| `future-sight/active/*.md` | active future anchor | 活躍前瞻錨點 |
| `web/` | workbench UI | 工作台介面 |
| `.claude/skills/engram-workbench/` | engram-workbench skill | 工作台 HTTP skill |

---

## 延伸閱讀

| 檔案 | 內容 |
|------|------|
| [README.md](./README.md) | 產品是什麼、如何啟動 |
| [api-docs/api.md](./api-docs/api.md) | HTTP API 契約 |
| [AGENTS.md](./AGENTS.md) | 給 coding agent 的專案脈絡 |
| [roadmap/mvp/INDEX.md](./roadmap/mvp/INDEX.md) | MVP 分層與設計決策 |
| [changelog.md](./changelog.md) | 版本演進 |
