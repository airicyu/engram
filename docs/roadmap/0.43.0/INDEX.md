# 0.43.0 — Dream run 檔與 reports 同步 TTL；尋問 recent ask

← [changelog](../../../changelog.md) · 上游：[0.42.0](../0.42.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**  
> 兩項：（1）`sweepDreamArtifacts` 刪 report／events 時 **一併刪** 同 `id` 的 `runs/{id}.yaml` 與 `{id}.input.json`，TTL 鍵與 0.21 相同；（2）尋問暫留近 **24 小時** 的問答，列表可點回看，**不**重跑 agent、**不**進 L0／L2。**無** store migrate；boot 仍 ≥ **0.40**。  
> **開工前仍須拍板：無。** 構想階段待拍板已在本 INDEX 鎖死。

## 產品句

> Staging 裡過期的夢只留與 report 同壽命的檔，不再堆永不刪的 run yaml。尋問能把最近一天問過的題與答案叫回來看，過期就丟掉。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作交接 |
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/how.md](./docs/how.md) | cleanup 刪哪些檔、Ask list wire、UI、config 鍵 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何可刪 yaml、問答為何不放 `/tmp` |

相關：[0.21 cleanup](../0.21.0/docs/dream-staging-cleanup.md) · [0.41 input.json](../0.41.0/INDEX.md) · [api.md Ask](../../../api-docs/api.md)

---

## 已定案

### A. `dreams/runs` 與 reports 同步 TTL

| # | 題 | 決定 |
|---|-----|------|
| A1 | 同一節奏 | **不**新開 yaml 專用天數。達「可刪該場 report／events」的**同一**年齡與鍵時，**一併刪**尚存的：`dreams/reports/{id}.md`、`dreams/runs/{id}/`、`dreams/runs/{id}.yaml`、`dreams/runs/{id}.input.json`。 |
| A2 | 鍵 | `committed` → `dream_committed_report_retention_days`（`-1`＝上述四類 **都不** TTL 刪）。`discarded`／`superseded`／無 yaml 孤兒 → `dream_staging_retention_days`（`0`＝關此類 TTL，仍跑 Recovery）。另套 `dream_cleanup_min_age_days`。年齡仍 `committed_at ?? created_at`；無 yaml 用 mtime。 |
| A3 | 永不 TTL 刪 | `status: pending`；`l1_clear_pending: true`（與 pending 同級，直到再 approve 清 scope 成功、旗標消失後才走 committed TTL）。`memories/**` 仍永不刪。 |
| A4 | 孤兒 yaml | report 已不在、yaml 仍在：只要狀態與年齡符合 A1／A2，仍刪 yaml＋input（冪等）。 |
| A5 | Recovery | R1 孤兒 draft、R2 stale job、R3 stale lock **不變**。 |
| A6 | 觀測 | `GET /status.dream_cleanup` 增加已刪 id 列表：`run_yamls_removed`、`input_jsons_removed`（可與既有 `reports_removed`／`event_dirs_removed` 並列；dry-run 同樣填）。 |
| A7 | Migrate／git | **無** hop；boot ≥ **0.40**。`dreams/` 本就不進 store git。 |

### B. 尋問 recent ask

| # | 題 | 決定 |
|---|-----|------|
| B1 | 壽命 | 有效 `ask_history_retention_hours`（workspace → env `ENGRAM_ASK_HISTORY_RETENTION_HOURS` → 預設 **24**）。整數 `≥ 0`；**`0`＝不寫歷史、列表只有可能的 running**。年齡用 `completed_at ?? started_at`。 |
| B2 | 筆數帽 | 先 TTL 再裁：終態最多留 **`ask_history_max_entries`**（workspace → `ENGRAM_ASK_HISTORY_MAX_ENTRIES` → 預設 **50**，整數 `≥ 1`）。超出刪最舊終態。 |
| B3 | 存放 | **不**把 24h 產品句寄在 `/tmp`。終態問答寫 `ENGRAM_STORE_DIR/dreams/ask-history/{job_id}.json`（**不**進 `memories/**`、**不**進 store git；與既有 `dreams/` 相同）。Running 仍用 `ENGRAM_TEMP_DIR` 既有 `ask/jobs/`。完成／失敗／取消後寫入 history json，temp 仍可 `pruneOldAskJobs`。 |
| B4 | 入列 | 終態 **`completed`／`failed`／`cancelled` 都寫** history（列表標 status）。Running **可**出現在列表（來自 temp），點了若尚無 answer 則只回填 `q`、答案區空或進度（與現況 running UI 一致，**不** POST）。 |
| B5 | 清理時機 | 與 dream sweep **同一** startup＋`dream_cleanup_cron`（不另開 ask cron）。達齡或超帽刪 `ask-history/{id}.json`。**不**刪 running temp。 |
| B6 | List API | **`GET /memories/ask/recent`**：200 `{ "items": [] }` 若空（不是 404）。無 query／分頁；多餘 query 忽略。新→舊（`started_at` 降序；同分 `job_id` `localeCompare` 升序）。每筆：`job_id`、`q`、`status`、`started_at`、`completed_at`（可 null）、`answer_preview`（見 HOW；**不要**整份 answer）。**不要**在 list 回 `sources`。 |
| B7 | 單筆 | 既有 `GET /memories/ask/{job_id}`：先 temp running／剛寫完，再 history json。無則 **200** `{ "present": false }`（現況已如此）。點列表用此拉全文 `q`＋`answer`。過期已刪＝`present: false`。 |
| B8 | 互斥 | 仍一場 running；`409 ask_busy` 不變。新提問 **不**清空 history。 |
| B9 | UI | 尋問 **Ask 模式**（非 Search）：recent 列表（題目、時間、status）。點一列：回填 textarea `q`，展示該次 `answer`（flex 答案區）；**禁止**因此自動 `POST /memories/ask`。**不**顯示 sources。空列表不當錯誤。 |
| B10 | Hash | **不**新增 `#/seek/ask/{job_id}`。 |
| B11 | 記憶層 | **不**寫 activities／STM／nodes／chain／clarify。 |

---

## 非目標

- 新 retention 天數鍵專給 yaml；永久保留 `runs/*.yaml`
- 改 approve／extract／0.41 快照語意；抬 boot；store migrate
- Vector search、記憶鏈橫向 strip、shared Zod、Ask 依活躍分
- Ask agent／prompt／`sources` 契約重做（JSON 仍可存在 job／history 檔，**UI 與 list API 不展示**）
- 跨裝置以外的同步（搬整份 store 則 `dreams/ask-history` 跟著走）
- 設定 GUI

---

## 實作軌道

### Track A — Dream run TTL

- **做：** `cleanup.ts` 在現有 T1／T2／T3 刪 report／events 的同一分支刪 yaml＋input；跳過 pending 與 `l1_clear_pending`；status 摘要兩新陣列；`cleanup.test.ts`；`docs/configurations.md` 與 api.md status 範例；本版 HOW 對照 0.21「永不刪 yaml」（0.21 歷史檔可留一句「至 0.42；0.43 改為同步刪」或只在 0.43 HOW／configurations 寫現況）。
- **不要做：** 改 lock／approve。
- **驗收：** committed 達齡：report、events dir、yaml、input 皆無；`l1_clear_pending` yaml 仍在；`-1` 不刪 committed 四類。

### Track B — Ask history API＋cleanup

- **做：** 終態寫 `dreams/ask-history/{id}.json`；`GET /memories/ask/recent`；config 兩鍵；sweep 內 prune history；根 endpoints；api.md。
- **不要做：** 改 `POST /memories/ask` body；廢 `ask_busy`。
- **驗收：** 完成一題後 list 有該 `job_id`；GET 單筆有 answer；retention 0 不寫檔；超齡檔消失。

### Track C — 尋問 UI＋出貨

- **做：** `SeekScene` Ask 模式列表＋點選回看；i18n 書面語；workbench skill／helper；phases；version／changelog／AGENTS；出貨後 **刪** 兩條 backlog `.md` 與 INDEX 列（GUIDELINES）。
- **不要做：** Search 模式做成 ask 歷史；顯示 sources。
- **驗收：** 點列不發 POST；`test:phases` 全綠。

---

## 驗收

- [x] committed 逾齡（且非 `-1`、非 `l1_clear_pending`）：`reports/{id}.md`、`runs/{id}/`、`runs/{id}.yaml`、`runs/{id}.input.json` 皆刪
- [x] `pending` 與 `l1_clear_pending: true` 的 yaml／input／report **不**因 TTL 刪
- [x] `dream_committed_report_retention_days=-1` 不刪 committed 上述檔
- [x] `GET /status.dream_cleanup` 含 `run_yamls_removed`／`input_jsons_removed`
- [x] `GET /memories/ask/recent` 空為 200 `{ "items": [] }`
- [x] 一題 `completed` 後 recent 有該筆；`GET /memories/ask/{id}` 有 `q`＋`answer`；list 無完整 answer、無 sources
- [x] 點 UI 列表回看＝回填 q＋顯示 answer，網路無新的 `POST /memories/ask`
- [x] `failed`／`cancelled` 可在列表見到對應 status
- [x] 達 `ask_history_retention_hours` 後該 json 被 sweep 刪、recent 不再列出
- [x] `bun run test:phases` 全綠
- [x] 無 migrate；boot ≥0.40
- [x] 出貨：`version.md`／changelog＝0.43.0；清兩條 backlog（GUIDELINES）

## 與上一版對照

| | 至 0.42 | 0.43 |
|--|---------|------|
| TTL 刪 `runs/*.yaml`／`*.input.json` | 永不（yaml）；input 未進 0.21 地圖 | 與 report 同壽命 |
| Ask 歷史 | temp＋KEEP_JOBS=5；無 list UI | store `dreams/ask-history`；24h＋帽 50；尋問列表 |
| `GET /memories/ask/recent` | 無 | 有 |
| migrate／boot | ≥0.40 | ≥0.40 |

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/store/dreams/cleanup.ts`、`cleanup.test.ts` | 同步刪 yaml／input |
| `server/src/store/dreams/dream-runs.ts` | pending／`l1_clear_pending` |
| `server/src/api/status.ts` | cleanup 摘要 |
| `server/src/store/tmp/ask-job.ts`、`server/src/seek/ask-run.ts`、`server/src/api/seek/ask.ts` | 寫 history、list、GET |
| `server/src/config.ts`、`docs/configurations.md` | 兩 ask 鍵 |
| `server/src/index.ts` | `GET /memories/ask/recent` |
| `web/src/scenes/SeekScene.tsx`、`web/src/hooks/useAskJob.ts`、`web/src/lib/api.ts` | 列表＋回看 |
| `docs/api-docs/api.md` | 契約 |
| `.agents/skills/engram-workbench/` | recent ask |
| `server/src/cli/self-test.ts` | phases |
