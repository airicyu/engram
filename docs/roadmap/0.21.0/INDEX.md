# 0.21.0 — 排程維護（dream cleanup ＋ nightly dream）

← [changelog](../../../changelog.md) · 上游：[0.20.0](../0.20.0/INDEX.md)（shipped）· current: [version](../../../version.md) `0.21.0` · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**（2026-08-04）  
> Dream staging startup＋in-process cron 清理；雙 retention config；activities integration skill；統一雙邊設定；高階 rollup 關帳／補建硬規則。

## 產品句

> Server 長期運行時，**in-process 定時**維護 dream staging（recovery＋可設定 TTL），並可選定時入夢 extract；人審 approve 不變。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、驗收 |
| 2 | [docs/dream-staging-cleanup.md](./docs/dream-staging-cleanup.md) | stale／TTL、config 鍵 |
| 3 | [docs/scheduler.md](./docs/scheduler.md) | 僅 in-process `Bun.cron` |
| 4 | [docs/reasoning.md](./docs/reasoning.md) | 否決 OS-level cron |

---

## 驗收（已勾）

### Track A — Dream staging cleanup

- [x] `dream_staging_retention_days=3`：`discarded` 逾齡刪 report；yaml 在
- [x] `dream_committed_report_retention_days=30`：`committed` 逾齡刪 report／events
- [x] `dream_committed_report_retention_days=-1`：不刪 `committed` report／events
- [x] `dream_staging_retention_days=0`：僅 Recovery
- [x] in-process cron ＋ startup 共用 `sweepDreamArtifacts()`
- [x] `bun test src/store/dreams/cleanup.test.ts`

**錨點：** `server/src/store/dreams/cleanup.ts`、`server/src/scheduler/`、`server/src/config.ts`

### Track B — Nightly auto dream

- [x] 預設 off；`auto_dream_enabled`＋`auto_dream_cron`（`30 3 * * *`）
- [x] `tryScheduledAutoDream()` skip 語意（empty pool、pending、lock）

### Track C — Activities integration skill

- [x] `.claude/skills/engram-activities-integration/`

### Track D — Unified configuration

- [x] 除 `ENGRAM_STORE_DIR` 外，所有設定可在 env 與 `engram.workspace.yaml` 雙邊設定
- [x] 優先序維持：workspace 鍵存在 → yaml；否則 env；否則預設
- [x] `docs/configurations.md` 重寫；`server/src/config.test.ts`

**錨點：** `server/src/config.ts`、`docs/configurations.md`

### Track E — 高階 rollup 關帳／補建

- [x] 開著週／月／年硬性不寫；closed＋缺檔強制 init
- [x] touched ∪ 磁碟掃描候選（week／month／year）
- [x] `candidates.test.ts`／`cascade.test.ts`；更新 `rollup-pipeline.md`

**錨點：** `server/src/dream/rollup/candidates.ts`、`cascade.ts`

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | Stale 分兩層 | Recovery vs TTL |
| 2 | `dream_staging_retention_days` | 預設 **3**；`0`＝關 staging TTL |
| 3 | `dream_committed_report_retention_days` | 預設 **30**；**`-1`＝永久** |
| 4 | 設定 | workspace yaml → env → 預設 |
| 5 | Cron | **僅 in-process**；否決 OS-level |
| 6 | Cleanup cron | `0 3 * * *`；enabled 預設 true |
| 7 | `dream_cleanup_on_start` | 預設 **true** |
| 8 | `runs/*.yaml` | 永不刪 |
| 9 | Store | 不 bump `store_version` |
| 10 | Auto dream | 預設 **off** |
| 11 | 設定雙邊 | 除 `ENGRAM_STORE_DIR` 外 env↔workspace；yaml 優先 |
| 12 | 高階 rollup | 開著不寫（硬）；已結束缺檔必補；month／year 同 week |

---

## 非目標（已遵守）

- OS-level cron、auto approve、store migrate
