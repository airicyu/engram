# Dream staging cleanup — stale／過期判斷

← [0.21.0 INDEX](../INDEX.md)

本檔定義 **何時可安全刪除** `ENGRAM_STORE_DIR/dreams/**` 下的 staging 產物。  
分 **兩層**：Recovery（立即、無年齡門檻）與 Retention TTL（按天數）。

---

## 產物地圖

| 路徑 | 用途 |
|------|------|
| `dreams/draft/{run_id}/` | pending 前工作樹 |
| `dreams/runs/{run_id}.yaml` | run 元資料（`pending`／`committed`／`discarded`／`superseded`） |
| `dreams/runs/{run_id}/events.jsonl` | 結構化事件 log |
| `dreams/reports/{run_id}.md` | 審閱 report |
| `dreams/dream-job.yaml` | 單例 async job |
| `dreams/extract-state.yaml` | 最近 extract 結果 |
| `dreams/dream.lock` | 互斥鎖（既有 30min stale） |

**永不自動刪：** `memories/**`、`dreams/runs/*.yaml`（審計與 `l1_clear_pending` 恢復）。

---

## 設定（已定案）

優先順序：**workspace `engram.workspace.yaml` → env → 預設**（與 `timezone` 等同模式）。

| 鍵（workspace／env） | 預設 | 合法值 | 意義 |
|----------------------|------|--------|------|
| `dream_staging_retention_days` | `3` | 整數 `≥ 0` | `discarded`／`superseded`／孤兒 report／events 的 TTL 天數；**`0`＝關閉此類 TTL**（仍跑 Recovery） |
| `dream_committed_report_retention_days` | `30` | 整數 `≥ 1` 或 **`-1`** | `committed` 的 report **與** `runs/{id}/` events；**`-1`＝永久保留**（不 TTL 刪） |
| `dream_cleanup_min_age_days` | `1` | 整數 `≥ 0` | 任一 TTL 刪除前最少天數（安全緩衝） |
| `dream_cleanup_cron` | `0 3 * * *` | cron 5 欄 | in-process 定時 sweep |
| `dream_cleanup_cron_enabled` | `true` | boolean | 關閉則僅 startup＋CLI |
| `dream_cleanup_on_start` | `true` | boolean | 啟動時 sweep |

Env 對照（實作時）：`ENGRAM_DREAM_STAGING_RETENTION_DAYS`、`ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS`、`ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS`、`ENGRAM_DREAM_CLEANUP_CRON`、`ENGRAM_DREAM_CLEANUP_CRON_ENABLED`、`ENGRAM_DREAM_CLEANUP_ON_START`。

**`store_version` 不 bump** — 僅新增 workspace 可選鍵；缺鍵用預設。

---

## 第一層：Recovery（stale — 立即）

不需等「過期天數」；**startup** 與 **in-process cron** 每次都跑。

### R1 — 孤兒 draft

| 條件 | 動作 |
|------|------|
| 存在 `dreams/draft/{id}/` | |
| **且** 無 `runs/{id}.yaml` 的 `status: pending` | |
| **且** `dream-job` 非 `running` 指向該 `id` | → `removeDraft(id)` |

### R2 — Crash 後卡住的 `dream-job`

| 條件 | 動作 |
|------|------|
| `dream-job.yaml` 的 `status: running` | |
| **且** restart 後／PID 死／lock stale 等（見 INDEX） | → 標 `failed`、`removeDraft`、釋放 lock、還原 `extract-state` |

### R3 — Stale lock

| 條件 | 動作 |
|------|------|
| `dream.lock` 存在 **且** `isLockStale()`（既有 30min） | → `breakStaleLock()` |

---

## 第二層：Retention TTL（過期 — 按天數）

### 年齡怎麼算

| 有 `runs/{id}.yaml` | 用 `committed_at ?? created_at` |
| 無 yaml（孤兒） | 用檔案／目錄 `mtime` |

所有 TTL 刪除須 **`age >= dream_cleanup_min_age_days`**。

### T1 — `committed`

| 設定 | 行為 |
|------|------|
| `dream_committed_report_retention_days === -1` | **永不** TTL 刪 report／events |
| `≥ 1` 且 `age >=` 該天數 | 刪 `reports/{id}.md`、`runs/{id}/`（events）；**保留** `{id}.yaml` |

### T2 — `discarded`／`superseded`

僅當 `dream_staging_retention_days > 0` 且 `age >=` 該天數：刪 report、events；**保留** yaml。

### T3 — 無 yaml 的孤兒 report／events

`dream_staging_retention_days > 0`、非 pending、`mtime` 達標 → 刪除。

### T1 表（速查）

| `status` | TTL 刪除對象 | 保留 | 用哪個設定鍵 |
|----------|--------------|------|----------------|
| `pending` | **無** | 全部 | — |
| `committed` | report、events（若未 `-1` 且達齡） | **yaml** | `dream_committed_report_retention_days` |
| `discarded` | report、events | **yaml** | `dream_staging_retention_days` |
| `superseded` | report、events | **yaml** | `dream_staging_retention_days` |

---

## 護欄總表

| 護欄 | 說明 |
|------|------|
| 永不刪 pending | `getPendingRun()` 的 id 全跳過 |
| 永不刪 run yaml | 所有 TTL 路徑 |
| `committed` `-1` | report／events 永久保留 |
| dry-run | CLI 只報告 |
| 冪等 | 重複 sweep 安全 |

---

## 實作錨點

- `sweepDreamArtifacts()` — startup、in-process cron、CLI **共用**
- 提前落地草稿 `cleanup.ts` 須對照本檔改為雙 retention 鍵與 `committed` `-1` 分支
