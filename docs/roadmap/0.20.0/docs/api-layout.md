# 0.20.0 — API handler 目錄重組

← [INDEX](../INDEX.md) · 閘門：[phase-gates.md](./phase-gates.md#phase-9--api-目錄)

> **Phase 9 HOW。** HTTP 契約不變。`api/` 按產品場景分組；拆開 `dream.ts` god file。

## 目標樹

```
server/src/api/
  activities.ts                 # POST /activities 僅 capture
  status.ts
  clock.ts
  dream/
    job.ts                      # startDreamJob／lock 非同步啟動共用
    run.ts                      # POST run／retry
    review.ts                   # GET pending、POST approve／discard／cancel
    involvements.ts             # PATCH node-score-involvements（2a）
    events.ts                   # GET dream events（原 dream-events.ts）
  seek/
    search.ts
    ask.ts
  memory/
    chain.ts
    nodes.ts
    future-sight.ts             # 自根目錄遷入
    short-term-memory.ts        # 自 activities/ 遷入
```

## 原則

1. 分組鍵＝**HTTP 產品域**（activities／dream／seek／memory／system），對齊 UI 場景。
2. **只搬家＋拆檔**；不改 status code、body、路徑。
3. `index.ts` 可改 import 路徑；不必保留舊 `api/dream.ts` 平鋪檔（可短暫 barrel，出貨前刪）。
4. 不重排 `store/`、`dream/` domain。

## 驗收

見 phase-gates Phase 9；`test:phases` 全過。
