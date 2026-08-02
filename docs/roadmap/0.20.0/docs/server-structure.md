# 0.20.0 — Server 結構清理

← [INDEX](../INDEX.md) · 閘門：[phase-gates.md](./phase-gates.md)

> Phase 4 專用 HOW。產品 HTTP 契約不變；只改內部邊界與死碼。

---

## 1. 刪除 dead patch materialize

### 現況

0.16 起主路徑為 **file deliverable**（agent 直接改 draft 檔）。  
`server/src/store/dreams/draft.ts` 內仍有 `materializeDraft`／`appendMaterializeDraft`（搜尋顯示 **無呼叫端**），與 `dream/schema.ts`、`store/dreams/patches.ts` 形成第二套 write model 幻覺。

### 做法

1. 全庫確認無動態 import／測試專用呼叫。
2. 刪除 materialize 函式與僅被其使用的輔助邏輯。
3. 若 `patches.ts`／schema 仍被「讀舊檔考古」或無關模組引用：保留最小型別，或一併刪並修編譯。
4. 更新任何仍描述「typed patch → materialize」的過時註解／README 片段（本版出貨文件波次處理亦可，但碼內註解勿誤導）。

### 驗收

符號消失；`test:phases` 仍過。

---

## 2. 拆分 `dream/run.ts`

### 現況

約 900 行：context 組裝、run／retry、approve（含 score、git、future-sight）、錯誤型別混雜。

### 目標邊界（檔名建議，可調整）

| 模組 | 職責 |
|------|------|
| `dream/context.ts`（或 `dream/build-context.ts`） | 組 `DreamContext`、凍結 scope |
| `dream/execute.ts` | `runDream`／`retryDream` 編排（lock 以外可留 api 層） |
| `dream/approve.ts` | `approveDream`：deploy、score、L1 clear、git |
| `dream/errors.ts` | `DreamIncompleteError` 等 |
| `dream/run.ts` | 薄 re-export **或**刪除改由 api import 新路徑 |

### 約束

- **不**改 `POST /dreams/*` path、主要 JSON 欄位名、409 語意。
- Score 結算掛點仍在 approve 成功路徑（對齊 0.19）；只搬檔不改公式。
- 每搬一塊就編譯／跑相關測試，避免一次大爆炸。

---

## 3. Agent factory

### 現況

`ENGRAM_AGENT` 在 `dream/run.ts`、`seek/ask-run.ts`、`agent/rollup.ts` 等處各自讀取與分支。

### 目標

```ts
// server/src/agent/factory.ts（示例）
type AgentMode = "claude" | "cursor" | "mock";
function resolveAgentMode(env?: string): AgentMode;
function createDreamRunner(mode: AgentMode): AgentRunner;
function createAskInvoker(...): ...;
function createRollupRunner(...): ...;
```

- 非法 mode → 啟動或首次使用時 **明確錯誤**（勿靜默當 claude）。
- Mock 規則三處一致。
- Write-policy（Phase 1）在 factory 建構時注入，避免漏套。

---

## 4. HTTP 邊界（本版最小）

Phase 3 已含 `node_refs`。Phase 4 可選但建議：

- 集中 JSON parse 錯誤 → 400（減少 `index.ts` 複製貼上）——**若改動面過大可只做 activities／dream 熱路徑**，其餘留後版。
- 不強制本版引入完整 Zod 路由層。

---

## 5. Atomic file write（可選）

對 `dream.lock`、`dream-job` YAML、workspace 等 **整檔覆寫**，改 temp＋rename 可降低截斷風險。  
**不要**為此重寫全部 store I/O；挑 lock／job 等高價值點即可。

---

## 6. Phase 7 延伸（generic flow＋目錄）

Phase 4 完成 factory／拆 `run` 後，Ask／Dream／Rollup 仍可能各有一套 Claude／Cursor spawn。  
**Phase 7** 定案見 **[agent-flow.md](./agent-flow.md)**（`AgentJob`／`AgentInvoker`、目標樹 `flow|providers|shared|dream|ask|rollup`、遷移 Step A–E）。  
本檔 Phase 4 條目不重複修改；實作 Phase 7 以 agent-flow 為準。

---

## 非本檔範圍

- Approve persisted journal（INDEX 非目標）。
- 把 `self-test.ts` 一次拆完（可開始抽 Phase 1–3 新檔）。
- Phase 7/8 細節（見 agent-flow.md/dream-layout.md）。
## 7. Phase 8 延伸（`src/dream/` 目錄）

Phase 4 拆檔後 `dream/` 仍平鋪。  
**Phase 8** 定案見 **[dream-layout.md](./dream-layout.md)**（lifecycle 子目錄＋`run.ts` barrel）。
