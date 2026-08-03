# 0.21.0 — reasoning

← [INDEX](../INDEX.md)

## 為何分 Recovery 與 TTL

- **Recovery** — 狀態機錯位（孤兒 draft、幽靈 job）；**結構條件**，不等天數。
- **TTL** — report／events 堆積；**年齡**；yaml 永久留索引。

## 為何 `committed` 獨立 retention 且支援 `-1`

- `discarded`／`superseded` 偏除錯殘留；預設 **3 天**可清（可調大）。
- `committed` report 是 **已批准歷史**；有人要長留審計 → **`-1` 永久保留**。
- 兩個 config 鍵避免「為了清 discard 把 committed 一起刪」或反過來。

## 為何僅 in-process cron（否決 OS-level）

| OS-level 問題 | in-process |
|---------------|------------|
| 搬移 repo／`ENGRAM_STORE_DIR` 後 crontab 仍指向舊路徑 | 隨 server 讀當前 config |
| 卸載／重裝後 **stale crontab 條目** 殘留 | process 結束即無 job |
| 須教使用者 `crontab -e`／`launchctl bootout` 清理 | 零系統側狀態 |
| 可能與 running server **雙重 sweep** | 單 process |

使用者明確偏好：**不要 OS-level**。Server 不常駐時靠 **startup sweep** 補償即可。

## 為何 startup ＋ in-process cron 都要

| 僅 startup | 僅 cron | 兩者 |
|------------|---------|------|
| 長駐不累積孤兒 | 關 server 永不掃 | crash 立刻修；長駐定期 TTL |

## 否決項

| 方案 | 為何不選 |
|------|----------|
| OS-level `Bun.cron(path, …)` | 見上；**0.21 非目標** |
| 僅 `setInterval` | 不對齊日曆／DST |
| 刪 `runs/*.yaml` | 審計／`l1_clear_pending` |
| cleanup 時 auto discard pending | 取代人審 |
| 單一 retention 鍵綁死 committed | 無法 `-1` 永久保留 committed |

## 提前落地程式碼

對話中曾實作 `cleanup.ts`／startup／CLI（**未出貨**）。開工 0.21 須補：

- in-process `Bun.cron`
- 雙 retention config（含 `committed` `-1`）
- 對照本版驗收
