# 0.14.0 — Store layout refactor（ENGRAM_HOME 目錄重整）

← [changelog](../../changelog.md) · 上游：[0.13.0](../0.13.0/INDEX.md) · current: [version](../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped（0.14.0）**  
> 本版是 **refactor**：重整 `ENGRAM_HOME` 目錄語意分組與清理廢路徑；**不開新記憶功能**；HTTP API 行為與路徑語意等價（僅磁碟位置變）。

## 產品句

> 打開任意 data workspace，能一眼分清「活記憶／dream 管線／可丟暫存」；廢目錄與只寫不讀的 meta 不再佔位；搜尋與文件仍認得 `memory-chain`、`short-term-memory` 等穩定關鍵字。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [AGENTS.md](../../AGENTS.md) | 操作邊界；出貨時路徑表須同步 |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Track、驗收 |
| 2 | [docs/store-layout.md](./docs/store-layout.md) | 目標樹、舊→新對照、ensure 清單 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何分組、否決項、反例 |
| 4 | [0.11 store-layout](../0.11.0/docs/store-layout.md) | chain 內部分組鍵（本版只加 `memory/` 前綴） |

---

## 與 0.13 對照

| 題 | 0.13 | 0.14 |
|----|------|------|
| Workspace 偏好 | `engram.workspace.yaml` | **不變**；並成為刪除 `meta.yaml` 的前提 |
| 活記憶路徑 | 頂層 `log/`、`short-term-memory/`、`nodes/`、`memory-chain/`、`future-sight/` | 全部收進 **`memory/`**（L0 改名 `activities/`） |
| Ask job 磁碟 | `memory/ask/jobs/` | **`tmp/ask/jobs/`**（HTTP 仍 `/memory/ask`） |
| 虛擬時鐘檔 | `meta/clock.json` | **`tmp/clock.json`** |
| Candidates | 頂層 `candidates/` | **`dream/candidates/attribution.yaml`**；廢 `nodes.yaml` |
| 廢殼 | `archive/`、`dream/reviews/` 等仍 ensure | **不再建立** |

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 本版性質 | **Layout refactor only**：不新增 patch 類型、不改 approve／capture 鎖語意、不改 search／ask HTTP 契約欄位 |
| 2 | 活記憶根 | **`memory/`** 含：`activities/`（L0）、`short-term-memory/`、`memory-chain/`、`nodes/`、`future-sight/` |
| 3 | 目錄名保留 | **`short-term-memory`**、**`memory-chain`** 字面保留（不改成 `l1`／`chain`） |
| 4 | L0 路徑 | **`memory/activities/events.jsonl`**（廢頂層 `log/events.jsonl` 作為 L0） |
| 5 | Future-sight | **`memory/future-sight/active/`** |
| 6 | 暫存根 | **`tmp/`**：至少 `tmp/ask/jobs/`、`tmp/clock.json` |
| 7 | Candidates | **`dream/candidates/attribution.yaml`**；**不**再 ensure `candidates/nodes.yaml` |
| 8 | 刪除／停寫 | **`meta.yaml`**（停寫不讀）；**`meta/`**；**`archive/`**；**`dream/reviews/`**；**`dream/dead-letter-archive/`**；**`dream/applied.yaml`**（廢主冪等殘留） |
| 9 | Ops log | 根目錄 `replay-cursor.log`（若仍用）→ **`log/replay-cursor.log`**；`log/` **不是** L0 |
| 10 | 路徑策略 | **只認新路徑**；禁止長期雙讀；集中 path helper |
| 11 | Draft／manifest | draft 內相對路徑改為新 live 相對路徑（見 store-layout） |
| 12 | HTTP | **`/memory/*`、`/dream/*`、`/capture`、`/clock`、`/future-sight` 等 URL 不變** |
| 13 | dream-job／extract-state | **留在 `dream/`**（不搬 `tmp/`） |
| 14 | 既有庫遷移（M1） | **一次性 Bun TypeScript CLI**（對齊 [`migrate-days-layout.ts`](../../server/src/cli/migrate-days-layout.ts)／`bun run …`）；**不是**手維護 bash 搬家腳本。讀 `ENGRAM_HOME`；冪等；只認新路徑（無雙讀）；遷移前須 **discard pending**（舊 draft 相對路徑不保証）；搬完可刪空舊目錄。出貨時 `server/package.json` 加 script（名稱實作定，例 `store:migrate-layout`） |

---

## 非目標

- 新功能：mindzone、future-sight 注入 search／ask、DLQ settlement UI、node merge
- Store local git 事務（見 [backlog/store-git-transactions.md](../backlog/store-git-transactions.md)）
- 改 HTTP 路徑或 JSON 欄位名（除文件中磁碟路徑字樣）
- 長期雙讀舊路徑、或「順便」重構 dream 狀態機
- 強制改名 `short-term-memory`／`memory-chain`
- 把 `dream-job.yaml`／`extract-state.yaml` 遷入 `tmp/`（本版明確不做）

---

## 實作軌道

### Track 0 — 契約文件先行

- **做：** 本版 `docs/store-layout.md` 視為磁碟契約；實作中若微調路徑須先改該檔再改碼。
- **不做：** 寫 migrate 細節進業務碼卻不更新對照表。
- **驗收：** 新 agent 只讀 store-layout 能畫出完整目標樹。

### Track 1 — Path helpers + ensure + 讀寫切換

- **做：** 收斂 `home.ts`／`l1`／`chain*`／`nodes`／`future-sight`／`events`／`memory-ask-job`／`clock`／`draft` materialize 相對路徑；`ensureEngramHome` 只建新樹、停寫廢檔。
- **不做：** 行為變更（清 L1 規則、lock、pending 語意）。
- **驗收：** 空 home 啟動後目錄符合 store-layout；`bun run test:phases` 在新路徑下全過。

### Track 2 — Prompt／文件／demo 路徑字樣

- **做：** `server/prompts/*`、`api-docs/`、`AGENTS.md`、`domain-language.md`、`demo/data-demo`（若本版要可跑）路徑更新。
- **驗收：** 文件與程式無舊頂層 `log/events.jsonl`、`meta/clock.json`、頂層 `candidates/` 作為現行契約。

### Track 3 — 遷移 CLI（已定案 #14）

- **做：** `server/src/cli/migrate-store-layout.ts`（或等價檔名）＋ `package.json` script；依 [store-layout 舊→新對照](./docs/store-layout.md) `rename`／搬移；清理廢檔與空目錄；console 摘要 moved／skipped。
- **不做：** bash 主路徑；雙讀；自動 approve／改寫 draft 內容。
- **驗收：** 對舊樹 fixture（或 data-demo 副本）跑一次後，server 只靠新路徑可運作；再跑一次 moved≈0（冪等）。

### Track 4 — 出貨

- **做：** `version.md` → `0.14.0`；`changelog.md`；狀態 → shipped。
- **驗收：** 總表全勾。

---

## 驗收總表

- [x] 空 `ENGRAM_HOME`：`ensure` 後樹狀符合 [store-layout.md](./docs/store-layout.md)；無 `meta.yaml`／`archive/`／`dream/reviews/`／頂層 `candidates/`
- [x] L0 寫入 `memory/activities/events.jsonl`；L1／chain／nodes／future-sight 均在 `memory/` 下且目錄名保留
- [x] Ask job 落在 `tmp/ask/jobs/`；虛擬時鐘檔在 `tmp/clock.json`；HTTP `/memory/ask`、`/clock` 行為不變
- [x] 低信心 attribution 寫入 `dream/candidates/attribution.yaml`
- [x] `bun run test:phases` 全過
- [x] api-docs／AGENTS／domain-language／prompts 路徑與行為一致
- [x] `bun run` 遷移 script：舊→新對照齊；冪等；遷移後不依賴舊路徑

---

## 錨點檔案

| 路徑 | 角色 |
|------|------|
| `server/src/store/home.ts` | ensure 目錄／初始檔 |
| `server/src/store/events.ts` | L0 路徑 |
| `server/src/store/l1.ts` | L1 |
| `server/src/store/chain.ts`、`chain-higher.ts` | memory-chain |
| `server/src/store/nodes.ts` | L2 |
| `server/src/store/future-sight.ts` | future-sight |
| `server/src/store/draft.ts` | materialize 相對路徑／candidates |
| `server/src/store/clock.ts` | `tmp/clock.json` |
| `server/src/store/memory-ask-job.ts` | `tmp/ask/jobs` |
| `server/src/cli/migrate-days-layout.ts` | 遷移 CLI 風格參考 |
| `server/prompts/*.md` | agent 可見路徑 |
| `api-docs/api.md`、`AGENTS.md`、`domain-language.md` | 契約與詞彙 |
