# 0.15.0 — Server `src/` 目標目錄與命名

← [INDEX](../INDEX.md) · 推理：[reasoning.md](./reasoning.md)

> **實作契約：** 本版只重整 **`server/src/` 模組路徑與識別子**，以及現行產品文件用語。  
> **不**改記憶庫磁碟樹（仍以 [0.14 store-layout](../../0.14.0/docs/store-layout.md) 為準）。  
> **不**改 HTTP path、query／body／response **欄位名**（含歷史 wire 名 `l1`／`l1_empty` 等）。

---

## 目錄原則（hybrid）

| 層 | 怎麼切 | 原因 |
|----|--------|------|
| `api/`、業務編排（`seek/`、`dream/`、`memory/`、`activities` handler） | **產品域**（Activities／Consolidate／Seek／Memory） | 改場景時 diff 局部；對齊 domain-language |
| `store/` | **技術層**，子目錄 **鏡像記憶庫樹** `memories/`／`dreams/`／`tmp/` | 跨場景共用讀寫；不把 L0／short-term 算成 Seek「擁有」 |
| `agent/` | **共用執行 infra** | extract／ask／rollup 共用 spawn；禁止再複製 Bun.spawn 輪子 |

**禁止：** 純 domain 把 `short-term-memory` 塞進 `seek/store/`；禁止再加 `domain/`／`application/`／`infrastructure/` 空殼層。

---

## 目標樹（`server/src/`）

實作後應接近：

```
server/src/
├── index.ts
├── config.ts
├── log.ts
├── yaml.ts
├── api/
│   ├── activities.ts              # 原 capture.ts → handleActivities
│   ├── activities/
│   │   └── short-term-memory.ts   # 原 api/memory/l1.ts
│   ├── dreams/                    # 可維持扁平 dream.ts + dream-events.ts；或收進子夾（等價即可）
│   │   ├── …                      # 現有 dream handlers（路徑可微調，勿改 HTTP）
│   ├── seek/
│   │   ├── search.ts
│   │   └── ask.ts
│   ├── memory/
│   │   ├── chain.ts
│   │   └── nodes.ts
│   ├── clock.ts
│   ├── status.ts
│   └── future-sight.ts
├── activities/                    # 可選：若 capture 編排變厚再抽；本版允許邏輯仍在 api/activities.ts
├── dream/                         # Consolidate 核心（既有；本版不重寫狀態機）
├── seek/                          # 原 memory/ 的 search + ask 編排
│   ├── search.ts
│   ├── ask-run.ts
│   └── emit-ask-event.ts
├── memory/                        # 只留 browse
│   └── browse.ts
├── store/
│   ├── home.ts
│   ├── clock.ts
│   ├── agent-process.ts
│   ├── run-id.ts
│   ├── memories/
│   │   ├── activities.ts          # 原 events.ts（L0）
│   │   ├── short-term-memory.ts   # 原 l1.ts
│   │   ├── nodes.ts
│   │   ├── chain.ts
│   │   ├── chain-higher.ts
│   │   ├── chain-time.ts
│   │   └── future-sight.ts
│   ├── dreams/
│   │   ├── draft.ts
│   │   ├── patches.ts
│   │   ├── dream-runs.ts
│   │   ├── dream-job.ts
│   │   ├── dream-events.ts
│   │   ├── extract-state.ts
│   │   ├── dlq.ts
│   │   └── lock.ts
│   └── tmp/
│       ├── ask-job.ts             # 原 memory-ask-job.ts
│       └── ask-events.ts          # 原 memory-ask-events.ts
├── agent/
│   ├── subprocess.ts              # 新建：共用 spawn
│   ├── temp-context.ts            # 新建：暫存 JSON context
│   ├── prompt-template.ts         # 新建：load + {{TOKEN}} render
│   ├── cursor-envelope.ts         # 可選：低階 envelope／fence
│   ├── …                          # 既有 runners（改呼叫共用 helper）
│   └── …
└── cli/
```

`api/dreams/` 是否子夾化：**可選**；驗收以「Seek／Memory／Activities／store 分組＋命名」為準，不必為改而改 dream API 檔名。

---

## 命名對照（程式識別子）

| 舊 | 新 |
|----|-----|
| `store/l1.ts` | `store/memories/short-term-memory.ts` |
| `isL1Empty` | `isShortTermMemoryEmpty`（或同義、全 repo 一致） |
| `MemoryL1Packet`／`handleMemoryL1` | `ShortTermMemoryPacket`／`handleShortTermMemory` |
| `api/capture.ts`／`handleCapture` | `api/activities.ts`／`handleActivities` |
| `store/events.ts` | `store/memories/activities.ts` |
| `server/src/memory/{search,ask-*}` | `server/src/seek/…` |
| `api/memory/search.ts`、`ask.ts` | `api/seek/search.ts`、`ask.ts` |
| `store/memory-ask-job.ts` 等 | `store/tmp/ask-job.ts` 等 |
| agent 檔名含 `memory-ask-*` | 可改 `ask-*`（與 seek 對齊）；若改動面過大可留檔名、只改 import 路徑——**優先改齊** |

匯出符號、型別名、註解、log 字串：**禁止**再把短期池稱為「L1」。歷史 wire 欄位名除外（見下）。

---

## 凍結的 HTTP／JSON wire 名（本版不得改）

下列是 **對外契約**，本版只改文件說明方式（「此欄位名歷史遺留，語意＝short-term memory …」），**不**改字串本身：

| Wire | 語意（文件應怎麼寫） |
|------|----------------------|
| `GET /memories/short-term-memory` | short-term memory 預覽（Activities） |
| `scope` 值 `l1` | 搜尋 short-term memory 池（**值仍為 `l1`**） |
| 搜尋結果鍵 `l1` | 同上 |
| hit 欄 `l1_note` | short-term 節點 notes 命中 |
| `/status`：`l1_empty` | short-term pool 是否空 |
| dream／status：`l1_clear_pending` | short-term 清理待重試 |
| 磁碟 `memories/short-term-memory/` | 不變（0.14） |

---

## 文件用語（現行契約文件）

出貨時更新（至少）：

| 檔 | 要求 |
|----|------|
| `docs/domain-language.md` | 層表：以 **short-term memory** 為正式名；廢「L1」作為現行術語。原 **L1.5** → **dream staging**（intent＝patches／report；draft＝`dreams/draft/`）。L0／L2 可保留為簡稱，並並列 activities／nodes |
| `CLAUDE.md` | 層表與操作邊界同語 |
| `docs/api-docs/*` | 敘述改 short-term memory／dream staging；wire 名表註明凍結 |
| `server/README.md`、`web/README.md` | 同上 |
| `.claude/skills/engram-workbench/SKILL.md` | 操作說明用語對齊 |

**不要求**改寫已 shipped 的舊 roadmap／舊 changelog 條目正文（歷史紀錄可保留當時用語）。`changelog.md` **頂部 0.15.0 條**用新語，並註明 rename。

---

## Agent 共用模組（Track R1）

### `agent/subprocess.ts`

提供類似：

```ts
runAgentCommand({
  cmd: string[];
  cwd: string;
  env?: Record<string, string | undefined>; // 預設剝除 ENGRAM_STORE_DIR
  processKey?: string;       // 有則 register／finally unregister
  onPid?: (pid: number) => void | Promise<void>;
}): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number; pid?: number }>
```

- 非 0 exit → throw，訊息含 stderr／stdout **截斷 preview**（對齊現有 extract／ask；rollup 現況丟 stderr → **改為同等 preview**）。
- **本版不加 timeout**（產品契約未定）。

### `agent/temp-context.ts`

`withTempJsonContext({ prefix, filename, value }, fn)` → mkdir、寫 JSON、把 path 傳給 fn、`finally` rm。供 extract／rollup；**不要**用於 ask job dir。

### `agent/prompt-template.ts`

`loadPrompt(absolutePath)` + `renderPrompt(template, vars)`；建議：若仍留有未替換的 `{{TOKEN}}` → throw（避免靜默壞 prompt）。

### Cancel／PID（本版必須）

遷移後下列 live spawn **皆**經 `processKey` 登記，且 dream cancel 能殺到 child：

| Runner | 現況 | 本版 |
|--------|------|------|
| Cursor extract | 有 registry + dream job pid | 保持（改走 subprocess） |
| Claude extract | **無** registry | **補上**（同 `dream:{run_id}` key） |
| Cursor／Claude ask | 有 | 保持 |
| Rollup Cursor plan／write | **無** | **補上**（key 建議 `dream:{run_id}:rollup` 或複用 dream key——實作選一並在 cancel 路徑 kill；見 INDEX 已定案） |

### Prompts

- 三份相同的 `rollup-plan-{week,month,year}.md` → 單一 `rollup-plan.md`（已有 `{{LEVEL}}`）。
- Writer prompts 維持分檔。

### 不做

- 統一成單一巨型 `AgentRunner` 涵蓋 extract／ask／plan／write。
- 合併各 workflow 的 schema 驗證。
- 合併領域 mock。
- 引入 agent timeout。
- 刪除前未確認的 `parseAskAgentStdout`：先 grep；確認無呼叫者則刪，有則補測或改用共用 envelope。
