# 0.24.0 — 空 pool 入夢＝rollup-only（關帳補建）

← [changelog](../../../changelog.md) · 上游：[0.23.0](../0.23.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> 短期記憶為空時，同一「入夢」動作仍可跑 **只做 higher-chain rollup**（跳過 day extract），以便關帳已結束的 week／month／year。**無** store migrate；**不**新增第二個產品動作或新 HTTP 動詞。

## 產品句

> 使用者在好幾天沒有新 activities、短期已空的情況下，仍可用**同一個入夢按鈕**觸發已結束期間的 week／month／year 補建（人審 approve 後才進 live）。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、軌道、驗收 |
| 2 | [docs/empty-dream-rollup.md](./docs/empty-dream-rollup.md) | 管線分支、API／UI、preflight |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何不新開端點／動作；否決項 |

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 產品動作 | **仍只有** Consolidate「入夢」＝`POST /dreams/run`。**不**新增「純 rollup」按鈕或 `POST /dreams/rollup` |
| 2 | 有 short-term 內容 | 行為與現況相同：day extract → materialize → rollup cascade → pending |
| 3 | 空 pool（scope＝[]） | **允許**入夢，但 **跳過** day extract agent；只跑 future-sight maintain（與現況相同前置）＋`prepareDreamDraft`＋**rollup cascade**＋report → `pending_review` |
| 4 | 空 pool 且無 rollup 工作 | 仍 **409** `nothing_to_dream`（錯誤碼不變，減少客戶端分叉）；message 可說明「無短期內容且無待關帳 higher chain」 |
| 5 | Preflight | 空 pool 時，在啟動 job／叫 agent **之前**做機械檢查：`touchedDayIds=[]` 下 week／month／year 經既有 `candidatesForRollup`＋`enforceRollupPlan` 後是否仍有 `execute` targets。無 → 409；有 → 202 |
| 6 | Report | scope 為空；Narrative 須標明本輪為 rollup-only（無新 events）；rollup 區段照舊列 init／revise |
| 7 | Approve | 與現況相同人審路徑；scope 空 → 無 L1 可清（或 clear no-op）；manifest 可僅含 higher summaries；`empty_patches` 僅當 cascade 也沒寫任何 draft 檔（正常不應發生，因 preflight 已擋） |
| 8 | Retry | pending 的 rollup-only 夢可 `POST /dreams/retry`（必填 `reason`）；仍空 scope、跳過 extract、重跑 cascade（注入上一輪摘要／reason 的既有 retry 語意能套則套，不能則至少重跑 cascade＋把 reason 寫進 report） |
| 9 | Auto dream | `tryScheduledAutoDream`：**不要**再因空 pool 一律 skip；改走與手動入夢相同規則（空 pool＋有 catch-up → rollup-only；否則 skip／等同 nothing_to_dream） |
| 10 | UI | Consolidate **不再**因 `l1_empty` 禁用入夢或前端直接擋掉；點了由 server 回 202／409。更新 i18n（`dream.l1_empty`／`advice.l1_empty`）避免「空＝絕對不能入夢」 |
| 11 | Store | **不** bump `store_version`；無新記憶檔契約；rollup 寫入路徑與 0.11／0.21 相同 |

## 非目標

- 新 HTTP 資源或第二個 Consolidate 主按鈕
- 改 week／month／year **開著期間不寫** 的硬規則
- 改「下層有內容」定義（week 仍看 day **summary** 等，見既有 candidates）
- 無 pending 的自動寫入 live（仍要 approve）
- Node merge、Codex／agent 預設變更
- 本版不要求 `GET /status` 新增 `rollup_catchup_available`（可列後續；本版靠可點＋409 即可）

## 實作軌道

### Track A — Server 管線分支

- **做：** `runDream`／`handleDreamRun` 空 pool 分支；抽出或共用 `hasRollupCatchupWork(today)`（基於既有 candidates／enforce）；rollup-only 路徑跳過 `doDreamFiles`；寫空 scope report；involvements：rollup-only 寫 `nodes: []` 或等價，避免 approve 校驗炸掉
- **不要：** 空 pool 仍呼叫 day extract agent「空轉」
- **驗收：** 見 checklist；單元／phase：空 pool＋人造缺 week summary → 202→pending；空 pool＋無缺檔 → 409

### Track B — Auto dream 對齊

- **做：** `tryScheduledAutoDream` 與手動同一 preflight
- **不要：** 排程另發明第二套 rollup API
- **驗收：** 空 pool＋有 catch-up 時排程會 `runDream`；否則 log skip

### Track C — UI／契約文件

- **做：** `ConsolidateScene` 去掉 `l1_empty` 禁用與 onDream 前置擋；i18n；`docs/api-docs/`、`AGENTS.md` 操作邊界一句；changelog／version 出貨時再改
- **不要：** 新場景或第二顆按鈕
- **驗收：** 空 L1 時按鈕可點；409 時顯示 server message

## 驗收

- [x] 空 pool＋存在「已結束、缺 higher、下層有內容」的 week／month／year → `POST /dreams/run` → **202** → pending；report scope 空；draft 含對應 higher summary；**無** day extract agent spawn（log／mock 可證）
- [x] 空 pool＋無上述 catch-up → **409** `nothing_to_dream`
- [x] 非空 pool → 行為與 0.23 等價（extract＋rollup）
- [x] Approve／discard／cancel 對 rollup-only pending 可用
- [x] UI：`l1_empty` 不再禁用入夢；文案已改
- [x] `auto_dream` 與手動同一空 pool 規則
- [x] 無 `store_version` bump

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/api/dream/run.ts` | 空 pool 目前直接 409 |
| `server/src/dream/execute/pipeline.ts` | `NothingToDreamError`；extract→rollup 順序 |
| `server/src/dream/rollup/candidates.ts` | 磁碟關帳候選（空 touched 仍可掃） |
| `server/src/dream/rollup/cascade.ts` | cascade 入口 |
| `server/src/scheduler/auto-dream.ts` | 空 pool skip |
| `web/src/scenes/ConsolidateScene.tsx` | `l1_empty` 禁用入夢 |
| `docs/roadmap/0.11.0/docs/rollup-pipeline.md` | rollup 契約摘要 |

## 與上一版對照

| | 0.23.0 | 0.24.0 |
|--|--------|--------|
| 空 pool 入夢 | 409 | 有 catch-up → rollup-only pending；否則 409 |
| 產品動作數 | 入夢 | **不變** |
| Agent CLI | ＋codex | 不變 |
