# Scheduler — Bun.cron（僅 in-process）

← [0.21.0 INDEX](../INDEX.md) · [Bun Cron — in-process](https://bun.com/docs/runtime/cron#buncronschedule-handler-in-process)

Engram **0.21 僅採 in-process** `Bun.cron(schedule, handler, { tz })`。  
**不做** OS-level `Bun.cron(path, schedule, title)` 註冊（見 [reasoning.md](./reasoning.md)）。

定時工作：

1. **Dream staging cleanup** — `sweepDreamArtifacts()`
2. **（可選）Nightly auto dream** — dream run pipeline

TZ＝有效 timezone（workspace → `ENGRAM_TZ` → `Asia/Hong_Kong`）。

---

## 架構

```
index.ts (server 啟動)
  ├─ sweepDreamArtifacts()              # startup（若 dream_cleanup_on_start）
  └─ registerEngramCronJobs()           # 新模組
        ├─ Bun.cron(cleanup_cron, …)    # 預設 0 3 * * *
        └─ Bun.cron(auto_dream_cron, …) # 可選；預設不註冊

server/src/scheduler/（待實作）
  ├─ registerEngramCronJobs()
  ├─ cleanup handler → sweepDreamArtifacts()（try/catch + log）
  └─ auto-dream handler → 條件檢查 → runDream
```

### Cleanup cron（定案）

```ts
function registerCleanupCron(): void {
  if (!config.dreamCleanupCronEnabled) return;
  Bun.cron(
    config.dreamCleanupCron, // 預設 "0 3 * * *"
    async () => {
      try {
        await sweepDreamArtifacts();
      } catch (e) {
        logError("scheduled dream cleanup failed", e);
      }
    },
    { tz: config.timezone },
  );
}
```

| 性質 | 說明 |
|------|------|
| **生命週期** | 隨 server process；關 server 即無 cron — 靠 **下次 startup sweep** 補償（見下） |
| **no-overlap** | Bun 保證：handler（含 Promise）結束後才排下次 |
| **dev hot** | `bun --hot` 重載時 cron 隨模組重註冊（Bun 文件） |
| **設定** | `dream_cleanup_cron`、`dream_cleanup_cron_enabled`（workspace／env） |

### Cron 錯過 03:00 時（已定案）

In-process cron **不補跑**：server 在 `0 3 * * *` 未運行 → 該次 trigger miss。  
**無妨** — startup 與 cron 共用 `sweepDreamArtifacts()`（Recovery ＋ TTL）。下次啟動時 startup sweep 會清掉已符合條件的產物；冪等，不需補跑七次 daily fire。  
僅當 `dream_cleanup_on_start=0` **且** 長期不開 server 才會堆積。

### CLI 角色

`bun run dreams:cleanup` 保留給 **手動**／腳本呼叫；**不**寫入系統 crontab。

---

## Cron 表達式

- 5 欄：`minute hour day-of-month month day-of-week`
- `{ tz: config.timezone }` — 與 dream「今天」一致
- 預設 cleanup：`0 3 * * *`（每天 03:00）
- 若 Track B 開 nightly dream：建議錯開分鐘（例 cleanup `0 3`、dream `30 3`）

`Bun.cron.parse(expr, …, { tz })` 可選用於 UI「下次執行時間」。

---

## Auto dream cron（Track B，可選）

與 cleanup **同一 scheduler 模組**；預設 **off**。

| | cleanup | auto dream |
|--|---------|------------|
| 預設 | cron on ＋ startup | off |
| 跳過 | 無（冪等） | empty pool、`pending_review`、lock 等 |

---

## 非目標（本版）

- OS-level `Bun.cron(path, …)`、`Bun.cron.remove()`、`register-cron` CLI
- 系統 crontab／launchd／Task Scheduler 整合
- Server 關閉時仍定時清 staging（接受；startup 補償）

---

## 驗收

- [ ] 僅 in-process；repo 內無 OS cron 註冊程式碼
- [ ] `dream_cleanup_cron_enabled=false` 不註冊 job
- [ ] handler 拋錯不殺 server
- [ ] TZ 來自 config.timezone
