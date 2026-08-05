# 0.15.0 — Server 內部整理（agent 共用 ＋ 命名／目錄對齊）

← [changelog](../../../changelog.md) · 上游：[0.14.0](../0.14.0/INDEX.md) · current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped（0.15.0）**  
> 本版是 **refactor**：整理 `server/src` 目錄與命名、抽出 agent 執行共用層、補齊 cancel／PID；**對齊現行文件用語**（廢 L1 作為正式名）。  
> **不**改記憶庫磁碟佈局；**不**改 HTTP path／JSON wire 欄位名；**不**開新記憶功能。

## 產品句

> 讀 `server/src` 與現行文件時，詞彙與產品循環一致（Activities／Consolidate／Seek／Memory；short-term memory；dream staging）；跑 agent 不再複製三套 spawn；cancel 不論 Cursor／Claude／rollup 都能殺到子行程——且既有 HTTP 客戶端零修改。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [AGENTS.md](../../../AGENTS.md) | 操作邊界；出貨後層表用語須同步 |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Track、驗收 |
| 2 | [docs/server-src-layout.md](./docs/server-src-layout.md) | 目標 `server/src` 樹、命名對照、凍結 wire、agent helper 契約 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何 hybrid、為何不動 HTTP、為何補 PID |
| 4 | [0.14 store-layout](../0.14.0/docs/store-layout.md) | 記憶庫磁碟（本版 **不**改） |
| 5 | [domain-language.md](../../domain-language.md) | 出貨時改寫現行術語 |

**讀完 1–3 即可開工**；無需依賴本對話以外的聊天紀錄。

---

## 與 0.14 對照

| 題 | 0.14 | 0.15 |
|----|------|------|
| 記憶庫磁碟 | `memories/`／`dreams/`／`tmp/` 硬切 | **不變** |
| HTTP path／JSON 鍵 | 硬切 `/activities`、`/dreams/*`、`/memories/*` | **不變**（含 `scope=l1`、`l1_empty` 等 wire 字串） |
| `server/src` 命名 | 仍 `l1`／`capture`／`memory/` 混 Seek | **對齊** short-term-memory／activities／seek／memory browse |
| Agent spawn | extract／ask／rollup 各自複製 | **共用** subprocess／temp-context／prompt-template |
| Dream cancel × Claude／rollup | Claude extract、rollup **未**進 process registry | **補齊**，與 Cursor extract 同等可殺 child |
| 文件用語 | 仍大量「L1」 | 現行文件改 **short-term memory**；原 L1.5 → **dream staging** |

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 本版性質 | **內部 refactor + 文件用語對齊**；無新 patch 類型；不改 approve／lock／search／ask **行為語意** |
| 2 | HTTP／JSON | **全部不動**：path、query、body、response 欄位名與枚舉字串（含 `l1`、`l1_empty`、`l1_clear_pending`、`l1_note`） |
| 3 | 磁碟 | **不**改 `ENGRAM_STORE_DIR` 樹；仍以 0.14 為準 |
| 4 | 目錄哲學 | **Hybrid**：`api`／業務按產品域；`store` 鏡像 `memories`／`dreams`／`tmp`；`agent` 共用。細節見 [server-src-layout.md](./docs/server-src-layout.md) |
| 5 | short-term 命名 | 程式檔名／識別子／**現行**文件與註解一律 **short-term memory**（`short-term-memory`／`shortTermMemory`）；**禁止**再用「L1」當現行正式名 |
| 6 | 原 L1.5 | 現行文件改稱 **dream staging**（intent＝patches＋report；draft＝`dreams/draft/`）；避免「無 L1 卻有 L1.5」 |
| 7 | L0／L2 | 可保留簡稱，文件須並列 activities／nodes；不強迫本版廢號 |
| 8 | `events.ts` | → `store/memories/activities.ts`（對齊 L0 磁碟 `memories/activities/`） |
| 9 | `capture.ts` | → `api/activities.ts`；`handleCapture` → `handleActivities` |
| 10 | `server/src/memory` | Seek 編排 → `seek/`；browse 留 `memory/browse.ts`；`api/memory/search|ask` → `api/seek/` |
| 11 | 舊 roadmap／舊 changelog 正文 | **不回溯**改寫；僅更新現行契約文件 + changelog **0.15.0** 條 |
| 12 | Agent 共用 | 抽出 `subprocess`／`temp-context`／`prompt-template`；（可選）envelope helper；**不**做巨型統一 Runner |
| 13 | Cancel／PID | Claude extract 與 rollup live spawn **必須** register；`POST /dreams/cancel` 能終止對應 child（與 Cursor extract 同等）。Rollup 與 extract 共用或擴充 process key 策略見 layout 文件；選定後 cancel 路徑必須覆蓋 |
| 14 | Timeout | **本版不加** agent timeout |
| 15 | Rollup plan prompts | 三份相同 plan → 單一 `rollup-plan.md`；write 分檔保留 |
| 16 | 版本切片 | R1（agent）＋R2（命名）＋R3（store／api 目錄）**同一 0.15.0** |
| 17 | 實作順序 | **先 R3 目錄搬遷 → R2 命名掃尾 → R1 agent 共用與 PID**（避免共用 helper 落地後再大搬） |

---

## 非目標

- 改 HTTP URL（例如 `/seek/search`）或改 wire 欄位／`scope` 枚舉字串
- 再搬記憶庫磁碟；migrate CLI
- Agent timeout；統一 extract／ask／rollup 輸出協定
- 重寫 dream 狀態機、DLQ UI、node merge、mindzone、future-sight 注入 Seek
- Store local git 事務（已出貨 → [0.16.0](../0.16.0/INDEX.md)）
- 回溯改寫已 shipped roadmap 內文

---

## 實作軌道

嚴格按序；每軌勾完再進下一軌。

### Track 0 — 契約錨點

- **做：** 實作中若微調目標樹，先改 [server-src-layout.md](./docs/server-src-layout.md) 再改碼。
- **不做：** 邊搬邊發明未寫入的第三套目錄哲學。
- **驗收：** 新 agent 只讀 layout 能畫出目標 `server/src` 樹與凍結 wire 表。

### Track 1 — R3：`store/` 分組 + `api`／業務域分夾

- **做：** 按 layout 搬移檔案與更新 import；`store/memories|dreams|tmp`；`api/seek`、`api/activities`、`api/memory`（browse）；`seek/` 與 `memory/browse`。
- **不做：** 改行為；改 HTTP；本軌可暫留部分舊識別子（下一軌清）但路徑應已就位。
- **驗收：** `bun run test:phases` 全過；`server/src/store/` 不再扁平堆滿跨域檔。

### Track 2 — R2：識別子與現行文件用語

- **做：** `l1`／`L1`／`capture`／`MemoryL1*` 等現行碼與註解改 short-term memory／activities；更新 `docs/domain-language.md`、`AGENTS.md`、`docs/api-docs/*`、server／web README、workbench skill；wire 名保留並在文件註明凍結。
- **不做：** 改 JSON 鍵或 `scope=l1` 字串；不改舊版 roadmap 正文。
- **驗收：** 現行契約文件與 `server/src` 註解無「L1」作為現行正式層名（允許「歷史欄位名 `l1_empty`」這類說明）；grep 抽查通過；`test:phases` 全過。

### Track 3 — R1：agent 共用 + cancel／PID

- **做：** `subprocess`／`temp-context`／`prompt-template`；extract Cursor／Claude、ask Cursor／Claude、rollup 改用；Claude extract＋rollup 進 registry；合併 `rollup-plan.md`；rollup 錯誤帶 stderr preview；清理確認無用的 `parseAskAgentStdout`。
- **不做：** timeout；巨型 Runner；改 prompt 業務規則（除 plan 併檔）。
- **驗收：** 各 live runner 無重複的「剝 ENGRAM_STORE_DIR + Bun.spawn + 手收 pipe」大段複製；Claude／rollup 取消路徑可殺 child（測試或明確手動步驟寫進 PR／changelog）；`test:phases` 全過。

### Track 4 — 出貨

- **做：** `version.md` → `0.15.0`；`changelog.md` 頂部條；本 INDEX 狀態 → `shipped`；勾驗收總表。
- **驗收：** 總表全勾。

---

## 驗收總表

- [x] `server/src` 樹符合 [server-src-layout.md](./docs/server-src-layout.md)（允許 dream API 檔是否子夾化的等價差異）
- [x] HTTP：既有 path 與 JSON 鍵／`scope=l1` 等行為與 0.14 **字串級**相容（self-test／既有客戶端無需改 URL）
- [x] 記憶庫磁碟佈局未改（對照 0.14 store-layout）
- [x] 現行文件：short-term memory、dream staging；不再以 L1／L1.5 為現行正式名
- [x] Agent：共用 spawn／temp／prompt helper；Claude extract 與 rollup 納入 cancel／PID
- [x] `rollup-plan.md` 單一檔；week／month／year write 仍分檔
- [x] `cd server && bun run test:phases` 全過
- [x] `version.md`／`changelog.md`／INDEX 狀態已更新

---

## 錨點檔案（改前必讀）

| 路徑 | 角色 |
|------|------|
| `server/src/store/*.ts`（扁平現況） | R3 搬遷來源 |
| `server/src/store/l1.ts` | → short-term-memory |
| `server/src/store/events.ts` | → memories/activities |
| `server/src/api/capture.ts` | → activities |
| `server/src/api/memory/*` | 拆 seek／memory／activities |
| `server/src/memory/*` | → seek + memory/browse |
| `server/src/agent/cursor-cli.ts`、`claude-code.ts` | extract；Claude 缺 registry |
| `server/src/agent/memory-ask-*.ts` | ask runners |
| `server/src/agent/rollup.ts` | rollup；缺 registry；stderr 丟棄 |
| `server/src/store/agent-process.ts` | cancel registry |
| `server/src/dream/cancel.ts` | cancel 入口 |
| `server/prompts/rollup-plan-*.md` | 併檔來源 |
| `server/src/cli/self-test.ts` | 契約回歸 |
| `docs/domain-language.md`、`AGENTS.md`、`docs/api-docs/api.md` | 用語／契約 |
