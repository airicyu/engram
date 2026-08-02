# 0.20.0 — Dream 目錄重組（lifecycle 分組）

← [INDEX](../INDEX.md) · 閘門：[phase-gates.md](./phase-gates.md#phase-8--dream-目錄)

> **Phase 8 HOW。** 產品 HTTP／記憶語意不變。對齊 Phase 7「按用途分夾」：把平鋪的 `server/src/dream/*.ts` 依 **入夢生命週期** 分組。  
> **勿與** `server/src/agent/dream/`（CLI runner）混淆——那邊是「怎麼叫 agent」；本檔是「dream 業務編排」。

---

## 1. 現況問題

Phase 4 已把 god `run.ts` 拆成 `execute`／`approve`／`context`／`errors`，但仍 **全部平鋪在 `dream/` 根目錄**（約 13 檔）。瀏覽時無法一眼看出：

- 哪一段是 **跑到 pending**
- 哪一段是 **人審／cancel**
- 哪一段是 **report／score／rollup**

與 Phase 7 後的 `agent/{flow,providers,ask,…}` 對比，`dream/` 變成下一處「單資料夾雜訊」。

---

## 2. 目標目錄（分組鍵＝lifecycle）

完成後應接近（檔名可微調，**子目錄名不可改語意**）：

```
server/src/dream/
  run.ts                      # 薄 barrel：對外穩定 re-export（保留 api／cli 既有 import）
  execute/                    # 入夢 → draft →（呼叫 agent／rollup）→ pending
    pipeline.ts               # 現 execute.ts：runDream／retryDream／executeDreamPipeline
    context.ts                # buildDreamContext、makeDreamRunId、retry summary helpers
  review/                     # 人審閘門與取消
    approve.ts                # getPending／approve／discard／computeDreamStatus
    cancel.ts
    cancel-state.ts
  report/                     # 報告組裝與事件
    finalize.ts               # 現 report-finalize.ts
    emit-event.ts
  score/                      # 0.19 node score（pending artifact＋approve 結算）
    involvements.ts           # 現 node-score-involvements.ts
  rollup/                     # 入夢後 higher-chain cascade（業務編排，非 agent CLI）
    cascade.ts                # 現 rollup.ts（runRollupCascade、types、format section）
    quality.ts                # 現 rollup-quality.ts
  shared/
    errors.ts                 # DreamIncompleteError 等（cancel 錯誤可仍從 cancel-state re-export）
  legacy/
    schema.ts                 # 舊 typed Patch／parseExtractStdout；僅供仍引用處（如 store/patches、log）
```

### 擺放原則

1. **第一層＝dream 生命週期階段**（execute → review；旁路 report／score／rollup），不是「一個檔一個概念亂平鋪」。
2. **`run.ts` 保留為公開 barrel**，減少 `api/dream.ts`、`cli/*`、`seek/*` 一次全改；內部改 `export * from "./execute/pipeline"` 等。出貨時允許呼叫端仍 `from "../dream/run"`。
3. **`agent/dream/` 不搬進這裡**；反向也一樣。cascade 類型若被 `agent/rollup` import，改指到 `dream/rollup/cascade`（或經 barrel）。
4. **legacy/schema**：本 Phase **以搬家為主**；若全庫確認 `parseExtractStdout`／stdout patch 解析已無執行期路徑，可另開清理（非本 Phase 必達）。勿在搬家時順便改 patch 語意。
5. **禁止**把 `store/dreams/*`（draft 檔 I/O、lock、job yaml）併入 `src/dream/`——store＝持久化，dream＝應用編排。

---

## 3. 與產品流程對照

| 產品步驟 | 目錄 |
|----------|------|
| `POST /dreams/run`／`retry` | `execute/` |
| agent 改 draft（CLI） | `agent/dream/`（不動） |
| finalize draft／report、involvements 校驗 | `execute/` 呼叫 `report/`＋`score/` |
| higher-chain rollup cascade | `execute/` 呼叫 `rollup/cascade`；CLI 在 `agent/rollup/` |
| `GET pending`／`approve`／`discard` | `review/approve` |
| `cancel` | `review/cancel*` |
| approve 時 score 結算 | `review/approve` → `score/involvements` |

---

## 4. 遷移步驟

| Step | 做什麼 | 驗收 |
|------|--------|------|
| A | 建子目錄；先搬 `shared/errors`、`report/*`、`score/*`（依賴少） | 編譯／import 修通 |
| B | 搬 `review/*`；`approve` import 路徑更新 | pending／approve 單元或 phases 相關段 |
| C | 搬 `rollup/*`；修 `agent/rollup`、`cli/backfill-chain` | rollup phase 過 |
| D | 搬 `execute/*`；更新 `run.ts` barrel | 主 dream 路徑過 |
| E | `schema` → `legacy/`；清根目錄平鋪（僅留 `run.ts`） | G8 全過 |

每步後建議：`cd server && bun run test:phases`（或至少跑到失敗快的相關段）。

---

## 5. 非本檔範圍

- 改 approve／score／rollup **行為**或 HTTP 契約
- 重排 `store/dreams/`、`api/`
- 刪除 legacy schema（可列後續；本 Phase 可選做若零風險）
- 與 `agent/` 再合併成單一 `dream` mega-package
