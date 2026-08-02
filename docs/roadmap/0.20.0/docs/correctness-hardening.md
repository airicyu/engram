# 0.20.0 — 正確性加固（Agent sandbox／Lock／Capture）

← [INDEX](../INDEX.md) · 閘門：[phase-gates.md](./phase-gates.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫 HOW 級細節，供實作 agent 對齊路徑與失敗模式。

---

## 1. Agent 寫入隔離

### 現況問題（改前必知）

- `server/src/agent/claude-code.ts`：`cwd: ctx.store_dir`，`--allowedTools Read,Write,Edit,Bash` → 可改整個記憶庫。
- `server/src/agent/cursor-cli.ts`：`--yolo`＋`--add-dir ctx.store_dir` → 同樣無寫入邊界。
- Ask／Rollup 有類似「整庫可寫」傾向（見 `ask-cursor.ts`、`rollup.ts`）。
- 產品不變量是 **draft → pending_review → approve 才進 live**；agent 直寫 live 會繞過人審與 git 事務。

### 目標不變量

```
approve 之前：
  live memories/**、engram.workspace.yaml、store .git/**
    ← agent 不可寫
  dreams/draft/{run_id}/**、該 run report、Ask/Rollup 契約交付檔
    ← agent 可寫
  live memories/**（及既有 prompt 需要的路徑）
    ← agent 可讀
```

### 建議實作順序

1. **定義單一政策模組**（例如 `agent/write-policy.ts`）：輸入 `store_dir`、`draft_dir`、`report_path`、ask workdir 等，輸出「可寫根列表」與「可讀根列表」。
2. **Dream Claude：** `cwd`＝temp workdir；`--allowedTools` 用 path-scoped `Edit(//{abs}/**)` 僅覆蓋可寫根；`--disallowedTools Bash`（**本版不給 Bash**，避免 shell 繞過寫 live）；`--add-dir` store 僅供 Read。
3. **Dream Cursor：** **移除**「對整個 store `--yolo`」；改 `--workspace`／`--add-dir` **僅可寫根**（draft＋reports＋workdir）。**Cursor OS `--sandbox` 預設 `disabled`**（寫入隔離靠 Engram write-policy；OS sandbox 需 kernel ≥6.2，WSL 5.x 會失敗）。可選 `ENGRAM_CURSOR_SANDBOX=enabled`。Live 內容以凍結 context JSON 為主。
4. **Ask／Rollup：** 套同一 `write-policy`；Ask 答案檔寫在既有 temp job 路徑；Rollup 只寫 draft 內 summary／plan workdir。Ask Cursor：`--add-dir` store 供讀，writable 僅 job dir。
5. **Mock：** `ENGRAM_AGENT=mock-*` 的 runner 必須走同一政策（`guardedWriteFile`／`assertWritablePath`）；`mock-malicious-live`／`mock-ask-malicious-live` 專供閘門。
6. **Prompt：** `dream-files.md` 聲明可寫根與「勿用 Bash 改 store」——**輔助**模型，**不**當唯一防線。

### 補丁句（實作定案）

- Dream／Ask／Rollup 的 Claude 路徑：**不給 Bash**（`--disallowedTools Bash`）。
- Cursor dream：**不再** `--add-dir ctx.store_dir` 搭配全域 yolo；改可寫根 `--add-dir`；OS sandbox 預設關。
- Mock 惡意寫入：`MockMaliciousLiveWriteRunner`／`MockAskMaliciousLiveWriteRunner`。

### 測試掛點

見 [phase-gates Phase 1](./phase-gates.md#phase-1--agent-寫入隔離)。`bun test src/agent/shared/write-policy.test.ts`（G1.1–G1.4）。

### 非本節範圍

- 不改 draft 目錄樹形狀（仍 `dreams/draft/{run_id}/`）。
- 不取消人審。

---

## 2. Owner-aware dream lock

### 現況問題

- `server/src/store/dreams/lock.ts`：`releaseLock()` 無條件 `unlink`。
- Stale：`breakStaleLock` 刪舊鎖 → 新 run acquire → 舊 run `finally` 再 `releaseLock()` → **新鎖被刪** → 雙 dream／雙 deploy 可能。
- `cancel.ts` 同樣無條件釋放。

### 目標 API（名稱可微調，語意不可弱）

```ts
interface LockMeta {
  holder: string;       // 邏輯名：dream-run / dream-approve / …
  token: string;        // 每次 acquire 產生的唯一 token（或與 run_id 綁定）
  acquired_at: string;
}

acquireLock(holder: string): Promise<LockMeta>; // 回傳含 token
releaseLock(token: string): Promise<boolean>;   // 僅 token 相符才刪；回傳是否刪除
// breakStaleLock：僅當 stale 時刪；回傳是否刪除
```

呼叫端必須把 **token** 存在該次 job／閉包，finally／cancel 帶同一 token。

### 呼叫點清單（漏改＝失敗）

| 位置 | 行為 |
|------|------|
| `api/dream.ts` run／retry／approve | acquire 存 token；錯誤路徑／成功路徑 release(token) |
| `dream/run.ts` 若仍直接 lock | 同上 |
| `dream/cancel.ts` | 用 job 記錄的 token release；無 token／不符 → 不刪他人鎖 |

### 檔案格式

`dreams/dream.lock` 仍為單檔 JSON；新增 `token` 欄。舊鎖無 token：**視為可 stale-break**（`isLockStale` 對缺 token 回 true）；`releaseLock(token)` 不符或不含 token → **不刪**。硬切、無熱升級需求。

### 測試掛點

[phase-gates Phase 2](./phase-gates.md#phase-2--owner-aware-lock)。

---

## 3. Capture 原子性與驗證

### 現況問題

- `nextEventId()`：`wc -l` → 並發可同號。
- `appendEvent` 與 short-term `appendPoolEntry`（read-all／rewrite-all）分步 → 半套狀態。
- `node_refs` 若為字串，`for...of` 逐字元當 id。

### 目標

1. **單一寫入臨界區**（process 內 mutex 即可；原型單機）：分配 id → append L0 → 更新 pool（及既有 derived notes）→ 成功才回 200。
2. ID：在臨界區內讀計數／最後 id，**+1** 後寫回；或 append 後以檔案長度確認——重點是並發下不重複。
3. Pool 更新失敗：回錯誤；盡力不留下「只有 L0」或「只有 pool」而不告知客戶端。補償策略允許「刪除剛 append 的 L0 最後一行」或「標記失敗並 log」——選簡單可測的一種，寫進註解。
4. HTTP：`node_refs` runtime 檢查為 `string[] | undefined`。

### 建議掛點

- `server/src/api/activities.ts`：驗證＋呼叫單一 `captureActivity(...)`。
- `server/src/store/memories/capture.ts`：process 內 mutex；id 取自 L0 最後一筆 +1；pool 失敗則盡力 rollback 剛 append 的 L0 行。
- `future-sight` 系統過期事件亦走 `captureActivity`。

### 測試掛點

[phase-gates Phase 3](./phase-gates.md#phase-3--capture-原子性)。

### 非本節範圍

- 多 process 多 server 實例搶同一 store（原型假設單 server）。若未來多實例，需檔案鎖／外存——**非 0.20**。
