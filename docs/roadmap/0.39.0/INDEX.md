# 0.39.0 — 入夢自動 approve、單一根 `.env`、寫入語體

← [changelog](../../../changelog.md) · 上游：[0.38.0](../0.38.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **in progress**（尚未出貨）  
> 本版三件事：（1）入夢成功後可自動 approve；（2）本機 env 只放 repo 根 `.env`；（3）`zh-Hant` 寫入語＝繁體中文書面語。無新 HTTP 動詞、無 migrate、不抬 boot gate、不做設定 UI。  
> **沒有 0.40.0**：根 `.env` 不另開版本。

## 產品句

> 入夢跑完且草稿可審時，預設立刻 deploy；要人手審就把設定關掉。設定 API 與 UI 時只改一份根 `.env`。繁中記憶正文用書面語。

## 已定案

### A. 自動 approve

| # | 題 | 決定 |
|---|-----|------|
| A1 | 鍵 | workspace `dream_auto_approve`（boolean）↔ env `ENGRAM_DREAM_AUTO_APPROVE`。優先序同既有：yaml 有鍵 → yaml；否則 env；否則預設。 |
| A2 | 預設 | **`true`**。要停在 pending → yaml `dream_auto_approve: false` 或 env `0`／`false`／`no`。 |
| A3 | 何時 | `POST /dreams/run`／`retry`／`amend` 的 async job **成功寫出 pending 之後**、釋放 dream lock **之前**，進程內呼叫既有 `approveDream`。排程 auto-dream 成功時同樣適用。 |
| A4 | 不自動 | extract／materialize **失敗**、**cancel**、沒有 pending → 不呼叫 approve。 |
| A5 | 自動失敗 | approve 丟錯 → **留下 pending**；job 仍 `completed`；`result.auto_approved=false` 且帶 `auto_approve_error`。 |
| A6 | 觀測 | `GET /status.dream_scheduler.dream_auto_approve`；job `result.auto_approved`。 |
| A7 | 測試 | `test:phases` **必須**設 `ENGRAM_DREAM_AUTO_APPROVE=0`；另以 phases／config 鎖預設 true。 |

### B. 單一 repo-root `.env`

| # | 決定 |
|---|------|
| B1 | 範例＝[`/.env.example`](../../../.env.example)；setup 只寫根 `.env`。 |
| B2 | Server 與 web **各寫一份**載入根 `.env` 的程式（不共享根目錄模組）。已設的 process.env 不覆寫。Vite `envDir`＝repo 根。 |
| B3 | 若仍存在 `server/.env`／`web/.env`：啟動警告並忽略；setup overwrite 會刪掉殘檔。 |

### C. 寫入語體

| # | 決定 |
|---|------|
| C1 | 碼仍為 `zh-Hant`｜`zh-Hans`｜`en`（API／workspace／JSON 不變）。 |
| C2 | Prompt 注入 `{{MEMORY_LANGUAGE}}` 時帶語體說明：`zh-Hant`＝繁體中文書面語（非口語粵語、非網路腔）。 |

### D. 共通

| # | 決定 |
|---|------|
| D1 | **無** migrate；boot 仍 ≥0.36。不新端點。不做設定頁。 |
| D2 | Web Bun 檔（`web/server.ts`、`web/load-root-env.ts`）納入 `web/tsconfig.json` 並加 `"types": ["bun"]`（僅 IDE／tsc；不改執行契約）。 |

## 非目標

- Workbench 開關、新 HTTP 欄位改 approve body
- 自動 approve 失敗改標 job `failed`
- 把 workspace yaml 搬進 `.env`
- 改記憶契約／抬 boot gate
- **不**另開 0.40.0

## 驗收

- [x] yaml／env／預設解析正確；未知鍵仍拒啟
- [x] 預設 true；phases 在 false 下仍全綠
- [x] 成功路徑：job 完成後無 pending、`auto_approved`
- [x] 失敗 extract 不 approve
- [x] setup 只寫根 `.env`；spawn 的 `ENGRAM_STORE_DIR` 不被根 `.env` 蓋掉
- [x] `zh-Hant` prompt 含「繁體中文書面語」
- [ ] `version.md`／changelog／AGENTS 標本版 **in progress**（出貨前再改 shipped）
- [x] `docs/configurations.md`／`api.md`／workbench skill 已寫 auto-approve 與根 `.env`

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/config.ts` | 允許鍵＋解析；`memoryLanguagePromptLabel` |
| `server/src/api/dream/job.ts` | job 成功後 maybe approve |
| `server/src/load-root-env.ts`、`web/load-root-env.ts` | 各載根 `.env` |
| `setup-wizard/server.ts` | 只寫根 `.env` |
| `web/vite.config.ts` | `envDir`＝repo 根 |
| `web/tsconfig.json` | 含 Bun prod 檔 |
| `server/prompts/*` | 寫入語體 |
| `server/src/cli/self-test.ts` | phases 關自動 approve；Phase 0.39 |

## 開工前仍須拍板

（無。）
