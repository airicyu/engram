# 0.24.0 — 空夢／rollup-only（HOW）

← [INDEX](../INDEX.md)

> 實作契約：同一 `POST /dreams/run` 在空 short-term 時如何變成 rollup-only。產品語意以 INDEX 為準。

---

## 1. 決策樹（server）

```
POST /dreams/run
  │
  ├─ pending_review？ → 409 pending_review
  ├─ lock？ → 409 dream_locked（stale 處理不變）
  │
  ├─ pool 非空？
  │     └─ 是 → 既有路徑（extract + rollup）→ 202
  │
  └─ pool 空
        ├─ hasRollupCatchupWork(today)？
        │     ├─ 否 → 409 nothing_to_dream
        │     │         message: 說明無短期且無待關帳 higher chain
        │     └─ 是 → 202 + job
        │              rollup-only pipeline（見 §2）
```

`today`＝有效時鐘日曆日（虛擬時鐘適用），與 extract／rollup 相同來源。

---

## 2. Rollup-only pipeline

相對 `executeDreamPipeline` 的差異：

| 步驟 | 有 pool（現況） | 空 pool（本版） |
|------|-----------------|-----------------|
| future-sight maintain (live) | 做 | **做**（不變） |
| `prepareDreamDraft` | 做 | **做** |
| day extract agent（`doDreamFiles`） | 做 | **跳過** |
| `finalizeDraftFromDisk`（extract 後） | 做 | 可先跑一次（空 draft）或延後到 cascade 後；**勿**假設有 appends |
| `runRollupCascade({ dayIds })` | dayIds 來自 draft chain days／summaries | `dayIds = []`（或僅機械掃到的相關日，但 **touched 可空**；候選靠磁碟掃描） |
| involvements artifact | extract 寫 | server 寫 `nodes: []`（或等價），避免 pending 校驗失敗 |
| `finalizeDreamReport` | scope＝events | scope＝`[]`；Narrative 註明 rollup-only |
| pending | 是 | 是 |

**禁止：** 空 scope 仍 spawn Claude／Cursor／Codex 做 day extract。

Rollup agent（planner／writer）**仍可** spawn——那是 cascade 本職。

---

## 3. `hasRollupCatchupWork(today)`

純機械、不叫 LLM。建議實作（名稱可微調）：

```ts
for (level of ["week", "month", "year"]) {
  const ids = await candidatesForRollup({ level, touchedDayIds: [], today });
  // build meta (exists / is_current) as cascade does
  const plan = enforceRollupPlan({
    level,
    plan: { level, execute: false, targets: [] },
    meta,
    touchedPeriods: new Set(),
  });
  if (plan.execute && plan.targets.length > 0) return true;
}
return false;
```

語意對齊 0.11／0.21：只認 **已結束＋缺檔＋下層有內容** 的強制 init（空 touched 時不會因「touched revise」而 true）。若日後要在空夢強制 revise 已有檔——**非本版目標**。

---

## 4. API

| 項目 | 契約 |
|------|------|
| Method／path | 仍 `POST /dreams/run`（無 body 欄位需求） |
| 202 | 與現況相同 shape（`job_id`／`status`／`message`） |
| 409 `nothing_to_dream` | 空 pool **且**無 catch-up；或（非本版改變）其他既有 nothing 條件 |
| 409 `pending_review`／`dream_locked` | 不變 |
| `GET /dreams/pending` | `scope: []` 合法；report 可讀 |
| Approve／discard／cancel／retry | path 不變 |

更新 `docs/api-docs/api.md`：刪除「空 pool 一律不能 dream」的絕對表述；改為上表。

Self-test／phases：更新「空 pool → 409」案例——改為「空 pool＋無 chain catch-up → 409」；另加「空 pool＋缺 closed week → 202」。

---

## 5. UI

[`ConsolidateScene.tsx`](../../../../web/src/scenes/ConsolidateScene.tsx)：

- `dreamDisabled`：**移除** `status.l1_empty` 條件（其餘 lock／pending／clearPending 保留）
- `onDreamRun`：**移除** `l1_empty` 提早 return；改信任 server 409 message
- i18n：`dream.l1_empty` 可刪或改為僅在 409 回顯時的後備文案；`advice.l1_empty` 改為「短期已空；若有待關帳的週／月／年，仍可入夢補建」之類（中英同步）

**不**新增第二顆按鈕。

---

## 6. Auto dream

[`auto-dream.ts`](../../../../server/src/scheduler/auto-dream.ts)：今日因空 pool 直接 skip。改為呼叫與 `handleDreamRun` 相同的 preflight（或直接 `runDream` 並把 `NothingToDreamError` 當 skip）。有 catch-up 則跑 rollup-only job。

---

## 7. 出貨文件

- `docs/api-docs/`、`AGENTS.md`（操作邊界：空 pool 可入夢若有 rollup catch-up）
- `changelog.md`／`version.md` → `0.24.0`（實作完成時）
- 本版 roadmap 狀態 → `shipped` 並勾驗收
