# 0.15.0 — Reasoning

← [INDEX](../INDEX.md) · 結構契約：[server-src-layout.md](./server-src-layout.md)

> **做什麼以 INDEX／server-src-layout 為準。** 本檔只留動機、反例、否決項。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 為何有本版

0.14 對齊了 **記憶庫磁碟** 與 **HTTP**（`memories/`／`dreams/`／`tmp/`）。  
`server/src/` 仍停在更早的命名：`l1`、`capture`、`memory/` 混 Seek＋Browse、`store/` 扁平雜物、agent 三套 spawn 複製貼上。新 agent 讀碼時會以為「Memory＝search」或「L1 是另一套 API」。

本版是 **程式與現行文件** 對齊 domain／0.14，不是再開功能。

---

## 為何 hybrid 目錄（不是純 domain／純 functional）

| 方案 | 否決原因 |
|------|----------|
| 純 domain（`seek/store/…`） | Dream／Seek／Activities **共用** short-term pool 與 nodes；硬劃「擁有者」會造成互相 import 或複製 persistence |
| 純 functional（維持扁平 `store/*.ts`） | 正是現況痛點；與 0.14 磁碟語意脫節 |
| Clean 三層空殼 | 體量不值；增加跳轉無收益 |

**選定：** 業務／`api` 按產品域；`store` 鏡像磁碟；`agent` 共用執行。

---

## 為何 HTTP／wire 名不動

0.14 剛硬切過 URL。本版若再改 `scope=l1`→`short-term-memory`、`l1_empty`→…，會強迫 web／skill／外部腳本再切一輪，且與「純 refactor、無產品行為變更」衝突。

**失敗模式：** 文件改稱 short-term memory，實作卻「順便」改 JSON 鍵 → UI 與 self-test 靜默壞掉。  
**防法：** INDEX 明示凍結表；驗收用現有 curl／`test:phases` 契約字串。

文件敘述可寫「欄位名 `l1_empty`（語意：short-term memory 是否為空）」——**改說明，不改鍵**。

---

## 為何廢「L1」現行術語（含文件）

磁碟與 API path 已是 `short-term-memory`；繼續在文件叫 L1，等於永遠兩套詞。使用者已要求識別子與文件／註解一併對齊。

| 舊 | 新（現行） | 備註 |
|----|------------|------|
| L1 | **short-term memory** | 程式 `shortTermMemory`／檔名 `short-term-memory` |
| L1.5 | **dream staging** | intent（patches／report）+ draft；避免「沒有 L1 卻有 L1.5」 |
| L0／L2 | 可留簡稱 | 並列 activities／nodes；非本版強迫廢號 |

舊 roadmap／舊 changelog **不回溯改寫**（歷史）。

---

## 為何 R1 必須補 Claude／rollup registry

Cancel 的產品語意是「停掉這次入夢相關的 agent 工作」。Cursor extract 有 PID registry；Claude extract 與 rollup 沒有 → 同一 `POST /dreams/cancel` 行為因 `ENGRAM_AGENT` 而異，且 rollup 長跑時 cancel 只停在檢查點、child 仍耗資源。

抽 `subprocess` 時若不定「預設可登記 processKey」，之後新增 runner 會再漏。故 **補齊與抽共用是同一軌**，不是可選 polish。

**Timeout：** 會改變 job 何時變 failed／cancelled，屬產品契約；本版刻意不做。

---

## 為何 prompts 只併 plan、不併 write

三份 `rollup-plan-*.md` 已逐字相同（靠 `{{LEVEL}}`）。Writer 的 week／month／year 指引實質不同（尤其 lived dimensions）——合併會變成巨型條件文，較難審。

---

## 否決／不做（摘要）

- 本版改 HTTP path 或 wire 欄位名  
- 記憶庫磁碟再搬一次  
- 巨型統一 AgentRunner  
- Agent timeout  
- 重寫 dream 狀態機、node merge、mindzone 等功能
